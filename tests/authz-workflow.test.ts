import { describe, it, expect } from "vitest";
import { can, type Actor } from "../lib/authz";
import { activeStages, planTransition, ALL_STAGES } from "../lib/workflow";
import { newVerificationCode, VERIFICATION_CODE_RE } from "../lib/verification-code";

const offering = { departmentId: "dCSC", assignedStaffIds: ["s1"] };
const actor = (a: Partial<Actor> & Pick<Actor, "role">): Actor => ({ userId: "u", ...a });

describe("authorization", () => {
  it("students only ever get their own view", () => {
    const st = actor({ role: "STUDENT", studentId: "st1" });
    expect(can(st, { type: "student.viewOwn" })).toBe(true);
    expect(can(st, { type: "offering.view", offering })).toBe(false);
    expect(can(st, { type: "offering.editScores", offering, stage: "DRAFT" })).toBe(false);
    expect(can(actor({ role: "STUDENT" }), { type: "student.viewOwn" })).toBe(false);
  });

  it("lecturers see and edit only assigned offerings, only in draft", () => {
    const lec = actor({ role: "LECTURER", staffId: "s1", departmentId: "dCSC" });
    const other = actor({ role: "LECTURER", staffId: "s2", departmentId: "dCSC" });
    expect(can(lec, { type: "offering.view", offering })).toBe(true);
    expect(can(other, { type: "offering.view", offering })).toBe(false);
    expect(can(lec, { type: "offering.editScores", offering, stage: "DRAFT" })).toBe(true);
    expect(can(lec, { type: "offering.editScores", offering, stage: "SUBMITTED" })).toBe(false);
    expect(can(lec, { type: "offering.review", offering })).toBe(false);
  });

  it("department roles are scoped to their department", () => {
    const hod = actor({ role: "HOD", departmentId: "dCSC" });
    const otherHod = actor({ role: "HOD", departmentId: "dIFT" });
    expect(can(hod, { type: "offering.review", offering })).toBe(true);
    expect(can(otherHod, { type: "offering.review", offering })).toBe(false);
    expect(can(hod, { type: "offering.editScores", offering, stage: "DRAFT" })).toBe(false);
  });

  it("super admin has no academic-record access", () => {
    const sa = actor({ role: "SUPER_ADMIN" });
    expect(can(sa, { type: "offering.view", offering })).toBe(false);
    expect(can(sa, { type: "offering.review", offering })).toBe(false);
    expect(can(sa, { type: "admin.manageAdmins" })).toBe(true);
  });
});

describe("workflow", () => {
  const stages = activeStages();
  it("walks the full chain with the right actors", () => {
    const steps: Array<[string, string, string]> = [
      ["DRAFT", "LECTURER", "SUBMITTED"],
      ["SUBMITTED", "DEPT_RESULT_OFFICER", "DEPARTMENTAL_REVIEW"],
      ["DEPARTMENTAL_REVIEW", "HOD", "HOD_APPROVAL"],
      ["HOD_APPROVAL", "FACULTY_ADMIN", "FACULTY_BOARD"],
      ["FACULTY_BOARD", "FACULTY_ADMIN", "SENATE_RATIFIED"],
      ["SENATE_RATIFIED", "FACULTY_ADMIN", "PUBLISHED"],
    ];
    for (const [from, role, to] of steps) {
      const t = planTransition({ current: from as never, action: "forward", role: role as never, stages });
      expect(t.ok && t.to).toBe(to);
    }
  });

  it("refuses the wrong actor and edits after publication", () => {
    expect(planTransition({ current: "DEPARTMENTAL_REVIEW", action: "forward", role: "LECTURER", stages }).ok).toBe(false);
    expect(planTransition({ current: "PUBLISHED", action: "forward", role: "FACULTY_ADMIN", stages }).ok).toBe(false);
  });

  it("requires a reason to return", () => {
    expect(planTransition({ current: "SUBMITTED", action: "return", role: "DEPT_RESULT_OFFICER", stages }).ok).toBe(false);
    const t = planTransition({ current: "SUBMITTED", action: "return", role: "DEPT_RESULT_OFFICER", stages, reason: "CSC/23/0012 exam score missing" });
    expect(t.ok && t.to).toBe("DRAFT");
  });

  it("skips disabled optional stages", () => {
    const short = activeStages(["DEPARTMENTAL_REVIEW"]);
    expect(short).toEqual(["DRAFT", "SUBMITTED", "DEPARTMENTAL_REVIEW", "PUBLISHED"]);
    const t = planTransition({ current: "DEPARTMENTAL_REVIEW", action: "forward", role: "HOD", stages: short });
    expect(t.ok && t.verb).toBe("PUBLISH");
    expect(ALL_STAGES).toHaveLength(7);
  });
});

describe("statement verification codes", () => {
  it("are 26 base32 characters (128 bits) and unique", () => {
    const codes = new Set(Array.from({ length: 2000 }, newVerificationCode));
    expect(codes.size).toBe(2000);
    for (const c of codes) expect(VERIFICATION_CODE_RE.test(c)).toBe(true);
  });
});
