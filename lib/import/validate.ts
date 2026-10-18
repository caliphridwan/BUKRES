/**
 * Result-import validation. Pure: takes parsed rows plus the context loaded
 * from the database, returns accepted and rejected rows. No writes happen here;
 * the service commits accepted rows in one transaction only after the uploader
 * confirms the preview (spec §6).
 */
import { combineScores, gradeScore, type GradingPolicy } from "../grading/engine";

export const TEMPLATE_COLUMNS = ["matric_no", "course_code", "session", "semester", "ca_score", "exam_score"] as const;
export const MAX_ROWS = 5000;

export type RawRow = Record<string, unknown>;

export interface ImportContext {
  course: { code: string; caMax: number; examMax: number; units: number };
  sessionName: string; // "2025/2026"
  semesterNumber: number; // 1 | 2
  /** Registered students for this offering, keyed by normalised matric number. */
  registrations: Map<string, { registrationId: string; locked: boolean }>;
  policy: GradingPolicy;
}

export interface AcceptedRow {
  row: number; // 1-based spreadsheet row incl. header → first data row is 2
  matricNo: string;
  registrationId: string;
  ca: number | null;
  exam: number | null;
  total: number | null;
  grade: string | null;
  gradePoint: number | null;
  outcome: "GRADED" | "ABSENT";
}

export interface RejectedRow {
  row: number;
  matricNo: string;
  errors: string[];
}

export interface ValidationResult {
  accepted: AcceptedRow[];
  rejected: RejectedRow[];
  /** Registered students with no row in the file. */
  missing: string[];
  fileErrors: string[];
}

export const normaliseMatric = (v: unknown) => String(v ?? "").trim().toUpperCase().replace(/\s+/g, "");
export const normaliseCode = (v: unknown) => String(v ?? "").trim().toUpperCase().replace(/\s+/g, " ");
const normaliseCodeLoose = (v: unknown) => normaliseCode(v).replace(/\s/g, "");

/** Header aliases accepted from hand-made sheets. */
const HEADER_ALIASES: Record<string, (typeof TEMPLATE_COLUMNS)[number]> = {
  matric: "matric_no", matric_no: "matric_no", matric_number: "matric_no", reg_no: "matric_no", registration_number: "matric_no",
  course: "course_code", course_code: "course_code", code: "course_code",
  session: "session", academic_session: "session",
  semester: "semester",
  ca: "ca_score", ca_score: "ca_score", continuous_assessment: "ca_score",
  exam: "exam_score", exam_score: "exam_score", examination: "exam_score",
};

export function normaliseHeaders(row: RawRow): RawRow {
  const out: RawRow = {};
  for (const [k, v] of Object.entries(row)) {
    const key = k.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
    out[HEADER_ALIASES[key] ?? key] = v;
  }
  return out;
}

const ABSENT_MARKERS = new Set(["ABS", "ABSENT", "AB"]);

function parseScore(v: unknown, label: string, max: number, errors: string[]): number | null | "ABSENT" {
  if (v == null || String(v).trim() === "") return null;
  const s = String(v).trim().toUpperCase();
  if (ABSENT_MARKERS.has(s)) return "ABSENT";
  if (!/^\d+(\.\d{1,2})?$/.test(s)) {
    errors.push(`${label} "${v}" is not a number with up to 2 decimals`);
    return null;
  }
  const n = Number(s);
  if (n > max) errors.push(`${label} ${n} exceeds the maximum of ${max} for this course`);
  return n;
}

function semesterNumber(v: unknown): number | null {
  const s = String(v ?? "").trim().toLowerCase();
  if (["1", "first", "1st", "first semester"].includes(s)) return 1;
  if (["2", "second", "2nd", "second semester"].includes(s)) return 2;
  return null;
}

export function validateRows(rawRows: RawRow[], ctx: ImportContext): ValidationResult {
  const fileErrors: string[] = [];
  if (rawRows.length === 0) fileErrors.push("The file has no data rows.");
  if (rawRows.length > MAX_ROWS) fileErrors.push(`The file has ${rawRows.length} rows; the limit is ${MAX_ROWS}.`);
  if (fileErrors.length) return { accepted: [], rejected: [], missing: [], fileErrors };

  const firstRow = normaliseHeaders(rawRows[0]!);
  const missingCols = TEMPLATE_COLUMNS.filter((c) => !(c in firstRow));
  if (missingCols.length) {
    return { accepted: [], rejected: [], missing: [], fileErrors: [`Missing column(s): ${missingCols.join(", ")}. Download the template.`] };
  }

  const accepted: AcceptedRow[] = [];
  const rejected: RejectedRow[] = [];
  const seen = new Map<string, number>();

  rawRows.forEach((raw, i) => {
    const r = normaliseHeaders(raw);
    const rowNo = i + 2;
    const matricNo = normaliseMatric(r.matric_no);
    const errors: string[] = [];

    // Skip fully blank lines silently (common at the end of sheets).
    if (Object.values(r).every((v) => v == null || String(v).trim() === "")) return;

    if (!matricNo) errors.push("Matric number is empty");
    if (normaliseCodeLoose(r.course_code) !== normaliseCodeLoose(ctx.course.code)) {
      errors.push(`Course code "${r.course_code ?? ""}" does not match ${ctx.course.code}`);
    }
    if (String(r.session ?? "").trim() !== ctx.sessionName) {
      errors.push(`Session "${r.session ?? ""}" does not match ${ctx.sessionName}`);
    }
    if (semesterNumber(r.semester) !== ctx.semesterNumber) {
      errors.push(`Semester "${r.semester ?? ""}" does not match semester ${ctx.semesterNumber}`);
    }

    const reg = matricNo ? ctx.registrations.get(matricNo) : undefined;
    if (matricNo && !reg) errors.push("Student is not registered for this course offering");
    if (reg?.locked) errors.push("Result is already approved or published; use the correction process");

    if (matricNo) {
      const prev = seen.get(matricNo);
      if (prev) errors.push(`Duplicate of row ${prev}`);
      else seen.set(matricNo, rowNo);
    }

    const ca = parseScore(r.ca_score, "CA", ctx.course.caMax, errors);
    const exam = parseScore(r.exam_score, "Exam", ctx.course.examMax, errors);

    let outcome: AcceptedRow["outcome"] = "GRADED";
    let caN: number | null = null;
    let examN: number | null = null;
    if (exam === "ABSENT") {
      outcome = "ABSENT";
      caN = ca === "ABSENT" ? null : ca;
    } else {
      if (ca === "ABSENT") errors.push("CA cannot be marked absent when an exam score is given");
      caN = ca === "ABSENT" ? null : ca;
      examN = exam;
      if (caN == null && ctx.course.caMax > 0) errors.push("CA score is missing");
      if (examN == null && ctx.course.examMax > 0) errors.push("Exam score is missing");
    }

    if (errors.length) {
      rejected.push({ row: rowNo, matricNo, errors });
      return;
    }

    let total: number | null = null;
    let grade: string | null = null;
    let gradePoint: number | null = null;
    if (outcome === "GRADED") {
      total = combineScores(caN ?? 0, examN ?? 0, ctx.course.caMax, ctx.course.examMax);
      const g = gradeScore(total!, ctx.policy);
      grade = g.grade;
      gradePoint = g.point;
    }
    accepted.push({ row: rowNo, matricNo, registrationId: reg!.registrationId, ca: caN, exam: examN, total, grade, gradePoint, outcome });
  });

  const present = new Set([...accepted, ...rejected].map((r) => r.matricNo));
  const missing = [...ctx.registrations.entries()]
    .filter(([m, r]) => !present.has(m) && !r.locked)
    .map(([m]) => m)
    .sort();

  return { accepted, rejected, missing, fileErrors };
}
