/**
 * GPA / CGPA calculation engine.
 *
 * The ONLY place in the application where grades, GPA, CGPA, earned units,
 * academic standing and degree class are computed. Pages, PDFs, reports and
 * snapshots all call into this module.
 *
 * Design rules (spec §5):
 *  - Pure functions, no I/O, no framework imports — trivially unit-testable.
 *  - Integer arithmetic: quality points and units are summed as integers and
 *    divided exactly once; rounding is applied once at the very end.
 *  - CGPA = Σ QP / Σ units across included attempts. Never an average of GPAs.
 *  - Only PUBLISHED + GRADED attempts count. Absent / incomplete / withheld /
 *    missing results are excluded from numerator AND denominator — never zero.
 *  - Repeat handling is a policy switch, not hard-coded.
 */

export type RoundingMode = "HALF_UP" | "TRUNCATE";
export type RepeatPolicy = "ALL_ATTEMPTS_COUNT" | "LATEST_ATTEMPT_ONLY" | "BEST_ATTEMPT_ONLY";
export type AttemptOutcome = "GRADED" | "ABSENT" | "INCOMPLETE";
export type ResultStatus = "DRAFT" | "IN_REVIEW" | "PUBLISHED" | "WITHHELD" | "SUPERSEDED";

export interface GradeBand {
  /** Inclusive lower bound of the total score. */
  min: number;
  /** Inclusive upper bound (informational; lookup uses `min` ordering). */
  max: number;
  grade: string;
  point: number;
  pass: boolean;
}

export interface NamedThreshold {
  name: string;
  /** Inclusive lower bound on CGPA. */
  min: number;
}

export interface GradingPolicy {
  bands: GradeBand[];
  /** Degree classes, any order; resolved highest-min first. */
  classes: NamedThreshold[];
  /** Academic standing bands, any order; resolved highest-min first. */
  standing: NamedThreshold[];
  decimals: number;
  rounding: RoundingMode;
  repeatPolicy: RepeatPolicy;
  maxScore: number;
}

/** One sitting of one course by one student. */
export interface Attempt {
  courseCode: string;
  units: number;
  /** Null when the outcome is not GRADED or the score is missing. */
  gradePoint: number | null;
  passed: boolean | null;
  outcome: AttemptOutcome;
  status: ResultStatus;
  /** Monotonic semester ordering key, e.g. startYear * 10 + semesterNumber. */
  semesterOrder: number;
  /** 1 for first sitting, 2+ for repeats within the same course. */
  attemptNo: number;
}

export interface Totals {
  units: number;
  qualityPoints: number;
  /** Rounded per policy, or null when no units are applicable. */
  gpa: number | null;
  /** Exact fraction for audit: [qualityPoints, units]. */
  exact: [number, number];
}

export interface ExcludedAttempt {
  courseCode: string;
  reason: "NOT_PUBLISHED" | "ABSENT" | "INCOMPLETE" | "WITHHELD" | "MISSING_SCORE" | "REPLACED_BY_REPEAT";
}

// ─── Default policy ──────────────────────────────────────────────────────────

/**
 * Common Nigerian 5-point scale. UNCONFIRMED for BUK — the Faculty must sign
 * off on bands, classes and standing before production use (spec §12).
 */
export const DEFAULT_POLICY: GradingPolicy = {
  bands: [
    { min: 70, max: 100, grade: "A", point: 5, pass: true },
    { min: 60, max: 69.99, grade: "B", point: 4, pass: true },
    { min: 50, max: 59.99, grade: "C", point: 3, pass: true },
    { min: 45, max: 49.99, grade: "D", point: 2, pass: true },
    { min: 40, max: 44.99, grade: "E", point: 1, pass: true },
    { min: 0, max: 39.99, grade: "F", point: 0, pass: false },
  ],
  classes: [
    { name: "First Class", min: 4.5 },
    { name: "Second Class (Upper Division)", min: 3.5 },
    { name: "Second Class (Lower Division)", min: 2.4 },
    { name: "Third Class", min: 1.5 },
    { name: "Pass", min: 1.0 },
    { name: "Below Pass", min: 0 },
  ],
  standing: [
    { name: "Good Standing", min: 1.5 },
    { name: "Academic Warning", min: 1.0 },
    { name: "Probation", min: 0 },
  ],
  decimals: 2,
  rounding: "HALF_UP",
  repeatPolicy: "ALL_ATTEMPTS_COUNT",
  maxScore: 100,
};

// ─── Policy validation ───────────────────────────────────────────────────────

export class PolicyError extends Error {}

/** Throws if bands overlap, leave gaps at whole-number scores, or miss 0. */
export function assertValidPolicy(policy: GradingPolicy): void {
  if (policy.bands.length === 0) throw new PolicyError("Grade scale has no bands");
  const sorted = [...policy.bands].sort((a, b) => a.min - b.min);
  if (sorted[0]!.min !== 0) throw new PolicyError("Lowest band must start at 0");
  const mins = new Set<number>();
  for (const b of sorted) {
    if (mins.has(b.min)) throw new PolicyError(`Duplicate band start ${b.min}`);
    mins.add(b.min);
    if (!Number.isInteger(b.point) || b.point < 0) throw new PolicyError(`Invalid grade point for ${b.grade}`);
    if (b.min > policy.maxScore) throw new PolicyError(`Band ${b.grade} starts above max score`);
  }
  if (!Number.isInteger(policy.decimals) || policy.decimals < 0 || policy.decimals > 4) {
    throw new PolicyError("decimals must be an integer 0–4");
  }
}

// ─── Grading a score ─────────────────────────────────────────────────────────

export interface GradedScore {
  total: number;
  grade: string;
  point: number;
  pass: boolean;
}

/** Map a total score to its band. Throws on out-of-range or non-finite input. */
export function gradeScore(total: number, policy: GradingPolicy = DEFAULT_POLICY): GradedScore {
  if (!Number.isFinite(total) || total < 0 || total > policy.maxScore) {
    throw new RangeError(`Score ${total} is outside 0–${policy.maxScore}`);
  }
  const band = [...policy.bands].sort((a, b) => b.min - a.min).find((b) => total >= b.min);
  if (!band) throw new PolicyError(`No band covers score ${total}`);
  return { total, grade: band.grade, point: band.point, pass: band.pass };
}

/** CA + exam with per-course maxima. Returns null when either part is missing. */
export function combineScores(
  ca: number | null | undefined,
  exam: number | null | undefined,
  caMax: number,
  examMax: number,
): number | null {
  if (ca == null || exam == null) return null;
  if (ca < 0 || ca > caMax) throw new RangeError(`CA ${ca} is outside 0–${caMax}`);
  if (exam < 0 || exam > examMax) throw new RangeError(`Exam ${exam} is outside 0–${examMax}`);
  // Work in hundredths to avoid float drift (e.g. 29.5 + 40.25).
  return Math.round(ca * 100 + exam * 100) / 100;
}

// ─── Rounding ────────────────────────────────────────────────────────────────

/** Exact rational rounding of qp/units. Integers in, number out. */
export function roundRatio(qp: number, units: number, decimals: number, mode: RoundingMode): number {
  if (units <= 0) throw new RangeError("units must be positive");
  if (!Number.isInteger(qp) || !Number.isInteger(units)) throw new RangeError("qp and units must be integers");
  const scale = 10 ** decimals;
  const scaled =
    mode === "HALF_UP"
      ? Math.floor((2 * qp * scale + units) / (2 * units))
      : Math.floor((qp * scale) / units);
  return scaled / scale;
}

export function formatGpa(value: number | null, decimals = 2): string {
  return value == null ? "—" : value.toFixed(decimals);
}

// ─── Inclusion rules ─────────────────────────────────────────────────────────

function exclusionReason(a: Attempt): ExcludedAttempt["reason"] | null {
  if (a.status === "WITHHELD") return "WITHHELD";
  if (a.status !== "PUBLISHED") return "NOT_PUBLISHED";
  if (a.outcome === "ABSENT") return "ABSENT";
  if (a.outcome === "INCOMPLETE") return "INCOMPLETE";
  if (a.gradePoint == null) return "MISSING_SCORE";
  return null;
}

/** Split attempts into those that count and those excluded (with reasons). */
export function partition(attempts: Attempt[]): { included: Attempt[]; excluded: ExcludedAttempt[] } {
  const included: Attempt[] = [];
  const excluded: ExcludedAttempt[] = [];
  for (const a of attempts) {
    const reason = exclusionReason(a);
    if (reason) excluded.push({ courseCode: a.courseCode, reason });
    else included.push(a);
  }
  return { included, excluded };
}

function compareRecency(a: Attempt, b: Attempt): number {
  return a.semesterOrder - b.semesterOrder || a.attemptNo - b.attemptNo;
}

/** Apply the repeat policy to eligible attempts. */
export function applyRepeatPolicy(
  eligible: Attempt[],
  policy: RepeatPolicy,
): { kept: Attempt[]; replaced: ExcludedAttempt[] } {
  if (policy === "ALL_ATTEMPTS_COUNT") return { kept: eligible, replaced: [] };
  const byCourse = new Map<string, Attempt[]>();
  for (const a of eligible) byCourse.set(a.courseCode, [...(byCourse.get(a.courseCode) ?? []), a]);
  const kept: Attempt[] = [];
  const replaced: ExcludedAttempt[] = [];
  for (const [code, list] of byCourse) {
    const sorted = [...list].sort(compareRecency);
    const winner =
      policy === "LATEST_ATTEMPT_ONLY"
        ? sorted.at(-1)!
        : // BEST: highest point; ties go to the most recent attempt
          sorted.reduce((best, a) => ((a.gradePoint ?? 0) >= (best.gradePoint ?? 0) ? a : best));
    kept.push(winner);
    for (const a of list) if (a !== winner) replaced.push({ courseCode: code, reason: "REPLACED_BY_REPEAT" });
  }
  return { kept, replaced };
}

// ─── Totals ──────────────────────────────────────────────────────────────────

export function totals(attempts: Attempt[], policy: GradingPolicy): Totals {
  let units = 0;
  let qp = 0;
  for (const a of attempts) {
    if (!Number.isInteger(a.units) || a.units < 0) throw new RangeError(`Invalid units for ${a.courseCode}`);
    units += a.units;
    qp += a.units * (a.gradePoint ?? 0);
  }
  return {
    units,
    qualityPoints: qp,
    gpa: units > 0 ? roundRatio(qp, units, policy.decimals, policy.rounding) : null,
    exact: [qp, units],
  };
}

function resolveThreshold(list: NamedThreshold[], value: number | null): string | null {
  if (value == null) return null;
  const hit = [...list].sort((a, b) => b.min - a.min).find((t) => value >= t.min);
  return hit?.name ?? null;
}

// ─── Public API ──────────────────────────────────────────────────────────────

export interface SemesterSummary {
  semesterOrder: number;
  semester: Totals;
  cumulative: Totals;
  /** Units of courses passed (each course counted once) up to this semester. */
  unitsEarned: number;
  /** Units registered this semester across all attempts, counted or not. */
  unitsRegistered: number;
  excluded: ExcludedAttempt[];
  standing: string | null;
  degreeClass: string | null;
  /** Course codes failed and not yet passed as of this semester. */
  outstanding: string[];
}

/**
 * Compute semester GPA and CGPA for every semester present in `attempts`.
 * `attempts` is the student's full history; the function handles ordering.
 */
export function computeHistory(attempts: Attempt[], policy: GradingPolicy = DEFAULT_POLICY): SemesterSummary[] {
  assertValidPolicy(policy);
  const orders = [...new Set(attempts.map((a) => a.semesterOrder))].sort((a, b) => a - b);

  return orders.map((order) => {
    const thisSemester = attempts.filter((a) => a.semesterOrder === order);
    const upTo = attempts.filter((a) => a.semesterOrder <= order);

    // Semester GPA: every eligible attempt sat this semester counts.
    const sem = partition(thisSemester);
    const semesterTotals = totals(sem.included, policy);

    // CGPA: eligible attempts to date, then the repeat policy.
    const cum = partition(upTo);
    const { kept } = applyRepeatPolicy(cum.included, policy.repeatPolicy);
    const cumulativeTotals = totals(kept, policy);

    // Earned units / outstanding: by course, based on whether any pass exists.
    const passedCourses = new Map<string, number>();
    const failedCourses = new Set<string>();
    for (const a of cum.included) {
      if (a.passed) passedCourses.set(a.courseCode, a.units);
      else failedCourses.add(a.courseCode);
    }
    const unitsEarned = [...passedCourses.values()].reduce((s, u) => s + u, 0);
    const outstanding = [...failedCourses].filter((c) => !passedCourses.has(c)).sort();

    return {
      semesterOrder: order,
      semester: semesterTotals,
      cumulative: cumulativeTotals,
      unitsEarned,
      unitsRegistered: thisSemester.reduce((s, a) => s + a.units, 0),
      excluded: sem.excluded,
      standing: resolveThreshold(policy.standing, cumulativeTotals.gpa),
      degreeClass: resolveThreshold(policy.classes, cumulativeTotals.gpa),
      outstanding,
    };
  });
}

/** Trend between the last two semesters with a GPA. */
export function gpaTrend(history: SemesterSummary[]): "up" | "down" | "flat" | null {
  const withGpa = history.filter((h) => h.semester.gpa != null);
  if (withGpa.length < 2) return null;
  const prev = withGpa.at(-2)!.semester.gpa!;
  const last = withGpa.at(-1)!.semester.gpa!;
  return last > prev ? "up" : last < prev ? "down" : "flat";
}

/** Semester ordering key shared by the app and the tests. */
export function semesterOrder(sessionStartYear: number, semesterNumber: number): number {
  return sessionStartYear * 10 + semesterNumber;
}
