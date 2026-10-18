import { describe, it, expect } from "vitest";
import { validateRows, type ImportContext, type RawRow } from "../lib/import/validate";
import { DEFAULT_POLICY } from "../lib/grading/engine";

const ctx = (): ImportContext => ({
  course: { code: "CSC 2201", caMax: 40, examMax: 60, units: 3 },
  sessionName: "2025/2026",
  semesterNumber: 1,
  registrations: new Map([
    ["CST/23/COM/00001", { registrationId: "r1", locked: false }],
    ["CST/23/COM/00002", { registrationId: "r2", locked: false }],
    ["CST/23/COM/00003", { registrationId: "r3", locked: true }],
    ["CST/23/COM/00004", { registrationId: "r4", locked: false }],
  ]),
  policy: DEFAULT_POLICY,
});

const row = (matric: string, ca: unknown, exam: unknown, over: Partial<RawRow> = {}): RawRow => ({
  matric_no: matric, course_code: "CSC 2201", session: "2025/2026", semester: "1", ca_score: ca, exam_score: exam, ...over,
});

describe("validateRows", () => {
  it("accepts valid rows and grades them", () => {
    const r = validateRows([row("cst/23/com/00001", "30", "45")], ctx());
    expect(r.rejected).toEqual([]);
    expect(r.accepted[0]!.total).toBe(75);
    expect(r.accepted[0]!.grade).toBe("A");
    expect(r.accepted[0]!.row).toBe(2);
  });

  it("accepts hand-made headers and loose course codes", () => {
    const r = validateRows([{ "Matric Number": "CST/23/COM/00001", Course: "csc2201", Session: "2025/2026", Semester: "First", CA: "20", Exam: "40" }], ctx());
    expect(r.rejected).toEqual([]);
    expect(r.accepted[0]!.grade).toBe("B");
  });

  it("rejects unknown students, wrong course/session/semester and locked results", () => {
    const r = validateRows(
      [
        row("CST/23/COM/09999", "30", "40"),
        row("CST/23/COM/00001", "30", "40", { course_code: "CSC 2202" }),
        row("CST/23/COM/00002", "30", "40", { session: "2024/2025", semester: "2" }),
        row("CST/23/COM/00003", "30", "40"),
      ],
      ctx(),
    );
    expect(r.accepted).toHaveLength(0);
    expect(r.rejected[0]!.errors.join()).toMatch(/not registered/);
    expect(r.rejected[1]!.errors.join()).toMatch(/does not match CSC 2201/);
    expect(r.rejected[2]!.errors).toHaveLength(2);
    expect(r.rejected[3]!.errors.join()).toMatch(/correction process/);
  });

  it("checks score limits, formats and missing values", () => {
    const r = validateRows([row("CST/23/COM/00001", "41", "45"), row("CST/23/COM/00002", "abc", ""), row("CST/23/COM/00004", "20.555", "40")], ctx());
    expect(r.rejected[0]!.errors.join()).toMatch(/exceeds the maximum of 40/);
    expect(r.rejected[1]!.errors.join()).toMatch(/not a number/);
    expect(r.rejected[1]!.errors.join()).toMatch(/Exam score is missing/);
    expect(r.rejected[2]!.errors.join()).toMatch(/up to 2 decimals/);
  });

  it("detects duplicates within the file", () => {
    const r = validateRows([row("CST/23/COM/00001", "30", "40"), row("CST/23/COM/00001", "31", "40")], ctx());
    expect(r.accepted).toHaveLength(1);
    expect(r.rejected[0]!.errors).toEqual(["Duplicate of row 2"]);
  });

  it("records ABS as absent, not as zero", () => {
    const r = validateRows([row("CST/23/COM/00001", "25", "ABS")], ctx());
    expect(r.accepted[0]!.outcome).toBe("ABSENT");
    expect(r.accepted[0]!.total).toBeNull();
    expect(r.accepted[0]!.gradePoint).toBeNull();
  });

  it("lists registered students missing from the file (excluding locked ones)", () => {
    const r = validateRows([row("CST/23/COM/00001", "30", "40")], ctx());
    expect(r.missing).toEqual(["CST/23/COM/00002", "CST/23/COM/00004"]);
  });

  it("reports file-level problems", () => {
    expect(validateRows([], ctx()).fileErrors[0]).toMatch(/no data rows/);
    expect(validateRows([{ matric_no: "x" }], ctx()).fileErrors[0]).toMatch(/Missing column/);
  });

  it("skips fully blank lines", () => {
    const r = validateRows([row("CST/23/COM/00001", "30", "40"), row("", "", "", { course_code: "", session: "", semester: "" })], ctx());
    expect(r.accepted).toHaveLength(1);
    expect(r.rejected).toHaveLength(0);
  });
});
