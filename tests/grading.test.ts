import { describe, it, expect } from "vitest";
import {
  DEFAULT_POLICY,
  applyRepeatPolicy,
  assertValidPolicy,
  combineScores,
  computeHistory,
  gpaTrend,
  gradeScore,
  roundRatio,
  semesterOrder,
  type Attempt,
  type GradingPolicy,
} from "../lib/grading/engine";

const S1 = semesterOrder(2023, 1);
const S2 = semesterOrder(2023, 2);
const S3 = semesterOrder(2024, 1);

function att(courseCode: string, units: number, score: number | null, extra: Partial<Attempt> = {}): Attempt {
  const g = score == null ? null : gradeScore(score);
  return {
    courseCode,
    units,
    gradePoint: g?.point ?? null,
    passed: g?.pass ?? null,
    outcome: "GRADED",
    status: "PUBLISHED",
    semesterOrder: S1,
    attemptNo: 1,
    ...extra,
  };
}

describe("gradeScore boundaries", () => {
  const cases: Array<[number, string, number]> = [
    [100, "A", 5], [70, "A", 5], [69.99, "B", 4], [60, "B", 4], [59, "C", 3], [50, "C", 3],
    [49, "D", 2], [45, "D", 2], [44, "E", 1], [40, "E", 1], [39.99, "F", 0], [39, "F", 0], [0, "F", 0],
  ];
  it.each(cases)("%d → %s (%d)", (score, grade, point) => {
    const g = gradeScore(score);
    expect(g.grade).toBe(grade);
    expect(g.point).toBe(point);
  });
  it("rejects out-of-range and non-finite scores", () => {
    expect(() => gradeScore(-1)).toThrow(RangeError);
    expect(() => gradeScore(100.01)).toThrow(RangeError);
    expect(() => gradeScore(Number.NaN)).toThrow(RangeError);
  });
});

describe("combineScores", () => {
  it("adds CA and exam without float drift", () => expect(combineScores(29.5, 40.25, 40, 60)).toBe(69.75));
  it("returns null when a part is missing (never zero)", () => {
    expect(combineScores(null, 50, 40, 60)).toBeNull();
    expect(combineScores(30, undefined, 40, 60)).toBeNull();
  });
  it("respects per-course maxima", () => {
    expect(() => combineScores(41, 50, 40, 60)).toThrow(RangeError);
    expect(combineScores(0, 100, 0, 100)).toBe(100); // e.g. a project with no CA
  });
});

describe("roundRatio", () => {
  it("rounds half up exactly (2.885 → 2.89)", () => expect(roundRatio(577, 200, 2, "HALF_UP")).toBe(2.89));
  it("truncates when configured (2.889… → 2.88)", () => expect(roundRatio(26, 9, 2, "TRUNCATE")).toBe(2.88));
  it("handles repeating decimals (2/3 → 0.67)", () => expect(roundRatio(2, 3, 2, "HALF_UP")).toBe(0.67));
  it("rejects zero units", () => expect(() => roundRatio(0, 0, 2, "HALF_UP")).toThrow());
});

describe("semester GPA — spec §6 worked example", () => {
  it("CSC201 A3, MTH203 B2, GST201 C2, CSC203 F3 → 29/10 = 2.90", () => {
    const [s] = computeHistory([
      att("CSC 201", 3, 75), att("MTH 203", 2, 64), att("GST 201", 2, 58), att("CSC 203", 3, 39),
    ]);
    expect(s!.semester.units).toBe(10);
    expect(s!.semester.qualityPoints).toBe(29);
    expect(s!.semester.gpa).toBe(2.9);
    expect(s!.outstanding).toEqual(["CSC 203"]);
    expect(s!.unitsEarned).toBe(7);
  });
});

describe("exclusions are never treated as zero", () => {
  it("excludes absent, incomplete, withheld, unpublished and missing", () => {
    const [s] = computeHistory([
      att("A", 3, 70),
      att("B", 3, null, { outcome: "ABSENT" }),
      att("C", 3, null, { outcome: "INCOMPLETE" }),
      att("D", 3, 80, { status: "WITHHELD" }),
      att("E", 3, 80, { status: "IN_REVIEW" }),
      att("F", 3, 80, { status: "DRAFT" }),
      att("G", 3, null),
    ]);
    expect(s!.semester.units).toBe(3);
    expect(s!.semester.gpa).toBe(5);
    expect(s!.excluded.map((e) => e.reason).sort()).toEqual(
      ["ABSENT", "INCOMPLETE", "MISSING_SCORE", "NOT_PUBLISHED", "NOT_PUBLISHED", "WITHHELD"].sort(),
    );
    expect(s!.unitsRegistered).toBe(21);
  });
  it("a semester with nothing countable has GPA null, not 0", () => {
    const [s] = computeHistory([att("A", 3, 70, { status: "IN_REVIEW" })]);
    expect(s!.semester.gpa).toBeNull();
    expect(s!.cumulative.gpa).toBeNull();
    expect(s!.degreeClass).toBeNull();
  });
  it("zero-unit courses do not change the GPA", () => {
    const [s] = computeHistory([att("A", 3, 70), att("SIWES", 0, 30)]);
    expect(s!.semester.gpa).toBe(5);
  });
});

describe("CGPA is weighted by units, never an average of GPAs", () => {
  it("S1: 4 units of A (5.00); S2: 16 units of C (3.00) → CGPA 3.40, not 4.00", () => {
    const history = computeHistory([
      att("X", 4, 75, { semesterOrder: S1 }),
      att("Y", 16, 55, { semesterOrder: S2 }),
    ]);
    expect(history[0]!.semester.gpa).toBe(5);
    expect(history[1]!.semester.gpa).toBe(3);
    expect(history[1]!.cumulative.gpa).toBe(3.4);
    expect(history[1]!.cumulative.exact).toEqual([68, 20]);
  });
  it("orders semesters regardless of input order", () => {
    const history = computeHistory([att("Y", 2, 55, { semesterOrder: S2 }), att("X", 2, 75, { semesterOrder: S1 })]);
    expect(history.map((h) => h.semesterOrder)).toEqual([S1, S2]);
  });
});

describe("repeat policies", () => {
  const history = [
    att("CSC 203", 3, 30, { semesterOrder: S1, attemptNo: 1 }), // F
    att("CSC 204", 3, 70, { semesterOrder: S1 }),
    att("CSC 203", 3, 62, { semesterOrder: S3, attemptNo: 2 }), // B
  ];
  const withPolicy = (repeatPolicy: GradingPolicy["repeatPolicy"]) =>
    computeHistory(history, { ...DEFAULT_POLICY, repeatPolicy }).at(-1)!;

  it("ALL_ATTEMPTS_COUNT keeps the failed attempt in CGPA: (0+15+12)/9 = 3.00", () => {
    const last = withPolicy("ALL_ATTEMPTS_COUNT");
    expect(last.cumulative.exact).toEqual([27, 9]);
    expect(last.cumulative.gpa).toBe(3);
  });
  it("LATEST_ATTEMPT_ONLY drops the earlier attempt: 27/6 = 4.50", () => {
    expect(withPolicy("LATEST_ATTEMPT_ONLY").cumulative.gpa).toBe(4.5);
  });
  it("BEST_ATTEMPT_ONLY keeps the higher grade", () => {
    expect(withPolicy("BEST_ATTEMPT_ONLY").cumulative.gpa).toBe(4.5);
  });
  it("a passed repeat clears the outstanding list and earns units once", () => {
    const last = withPolicy("ALL_ATTEMPTS_COUNT");
    expect(last.outstanding).toEqual([]);
    expect(last.unitsEarned).toBe(6);
  });
  it("BEST prefers the most recent attempt on a tie", () => {
    const a = att("Z", 2, 50, { semesterOrder: S1 });
    const b = att("Z", 2, 55, { semesterOrder: S2, attemptNo: 2 });
    const { kept } = applyRepeatPolicy([a, b], "BEST_ATTEMPT_ONLY");
    expect(kept).toEqual([b]);
  });
});

describe("standing, degree class, trend", () => {
  it("classifies CGPA boundaries", () => {
    const cls = (score: number) => computeHistory([att("A", 1, score)])[0]!.degreeClass;
    expect(cls(70)).toBe("First Class");
    expect(cls(60)).toBe("Second Class (Upper Division)");
    expect(cls(50)).toBe("Second Class (Lower Division)");
    expect(cls(45)).toBe("Third Class");
    expect(cls(40)).toBe("Pass");
    expect(cls(10)).toBe("Below Pass");
  });
  it("CGPA 4.495 → 4.50 First Class with HALF_UP, 4.49 Second Upper with TRUNCATE", () => {
    // 99 units of A (495 QP) + 101 units of B (404 QP) = 899 / 200 = 4.495
    const attempts = [att("A", 99, 75), att("B", 101, 65)];
    const up = computeHistory(attempts)[0]!;
    expect(up.cumulative.exact).toEqual([899, 200]);
    expect(up.cumulative.gpa).toBe(4.5);
    expect(up.degreeClass).toBe("First Class");
    const trunc = computeHistory(attempts, { ...DEFAULT_POLICY, rounding: "TRUNCATE" })[0]!;
    expect(trunc.cumulative.gpa).toBe(4.49);
    expect(trunc.degreeClass).toBe("Second Class (Upper Division)");
  });
  it("reports trend between the last two GPAs", () => {
    const h = computeHistory([att("X", 3, 75, { semesterOrder: S1 }), att("Y", 3, 55, { semesterOrder: S2 })]);
    expect(gpaTrend(h)).toBe("down");
    expect(gpaTrend(h.slice(0, 1))).toBeNull();
  });
});

describe("policy validation", () => {
  it("accepts the default policy", () => expect(() => assertValidPolicy(DEFAULT_POLICY)).not.toThrow());
  it("rejects a scale that does not start at 0", () => {
    expect(() => assertValidPolicy({ ...DEFAULT_POLICY, bands: DEFAULT_POLICY.bands.slice(0, 5) })).toThrow();
  });
  it("rejects duplicate band starts", () => {
    const bands = [...DEFAULT_POLICY.bands, { min: 70, max: 100, grade: "A+", point: 5, pass: true }];
    expect(() => assertValidPolicy({ ...DEFAULT_POLICY, bands })).toThrow();
  });
});
