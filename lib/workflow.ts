/**
 * Result approval workflow — pure rules, no I/O.
 *
 * A stage names what has been achieved so far; the actor at a stage is the
 * role that may move the submission forward from it:
 *
 *   DRAFT ──lecturer/DRO submit──▶ SUBMITTED ──DRO──▶ DEPARTMENTAL_REVIEW ──HOD──▶
 *   HOD_APPROVAL ──admin──▶ FACULTY_BOARD ──admin──▶ SENATE_RATIFIED ──admin──▶ PUBLISHED
 *
 * Any actor at a review stage may RETURN it to DRAFT with a reason.
 * Optional stages can be switched off per faculty (Setting WORKFLOW_STAGES).
 */

export type Stage =
  | "DRAFT"
  | "SUBMITTED"
  | "DEPARTMENTAL_REVIEW"
  | "HOD_APPROVAL"
  | "FACULTY_BOARD"
  | "SENATE_RATIFIED"
  | "PUBLISHED";

export type Role = "STUDENT" | "LECTURER" | "DEPT_RESULT_OFFICER" | "HOD" | "FACULTY_ADMIN" | "SUPER_ADMIN";

export const ALL_STAGES: Stage[] = [
  "DRAFT",
  "SUBMITTED",
  "DEPARTMENTAL_REVIEW",
  "HOD_APPROVAL",
  "FACULTY_BOARD",
  "SENATE_RATIFIED",
  "PUBLISHED",
];

/** Stages that may be disabled. DRAFT, SUBMITTED and PUBLISHED are mandatory. */
export const OPTIONAL_STAGES: Stage[] = ["DEPARTMENTAL_REVIEW", "HOD_APPROVAL", "FACULTY_BOARD", "SENATE_RATIFIED"];

export const STAGE_LABEL: Record<Stage, string> = {
  DRAFT: "Draft",
  SUBMITTED: "Awaiting departmental review",
  DEPARTMENTAL_REVIEW: "Awaiting HOD approval",
  HOD_APPROVAL: "Awaiting Faculty Board",
  FACULTY_BOARD: "Awaiting Senate ratification",
  SENATE_RATIFIED: "Ratified — ready to publish",
  PUBLISHED: "Published",
};

/** Role that acts on a submission sitting at each stage. */
const ACTOR: Partial<Record<Stage, Role[]>> = {
  DRAFT: ["LECTURER", "DEPT_RESULT_OFFICER"],
  SUBMITTED: ["DEPT_RESULT_OFFICER"],
  DEPARTMENTAL_REVIEW: ["HOD"],
  HOD_APPROVAL: ["FACULTY_ADMIN"],
  FACULTY_BOARD: ["FACULTY_ADMIN"],
  SENATE_RATIFIED: ["FACULTY_ADMIN"],
};

export function activeStages(enabledOptional: Stage[] = OPTIONAL_STAGES): Stage[] {
  return ALL_STAGES.filter((s) => !OPTIONAL_STAGES.includes(s) || enabledOptional.includes(s));
}

export function nextStage(current: Stage, stages: Stage[]): Stage | null {
  const i = stages.indexOf(current);
  if (i < 0 || i === stages.length - 1) return null;
  return stages[i + 1]!;
}

/**
 * Who acts at `current` when some stages are disabled: the actor of the
 * stage itself, which is still in the list. (If HOD_APPROVAL is off, the
 * HOD's DEPARTMENTAL_REVIEW step leads straight to FACULTY_BOARD.)
 */
export function actorsFor(current: Stage): Role[] {
  return ACTOR[current] ?? [];
}

export type Transition =
  | { ok: true; verb: "SUBMIT" | "ADVANCE" | "PUBLISH" | "RETURN"; to: Stage }
  | { ok: false; error: string };

export function planTransition(args: {
  current: Stage;
  action: "forward" | "return";
  role: Role;
  stages: Stage[];
  reason?: string;
}): Transition {
  const { current, action, role, stages } = args;
  if (!stages.includes(current)) return { ok: false, error: `Stage ${current} is not active in this workflow` };
  if (current === "PUBLISHED") {
    return { ok: false, error: "Published results can only change through the correction process" };
  }
  if (!actorsFor(current).includes(role)) {
    return { ok: false, error: `${STAGE_LABEL[current]} — this step is not yours to take` };
  }
  if (action === "return") {
    if (current === "DRAFT") return { ok: false, error: "A draft cannot be returned" };
    if (!args.reason || args.reason.trim().length < 10) {
      return { ok: false, error: "A reason of at least 10 characters is required to return results" };
    }
    return { ok: true, verb: "RETURN", to: "DRAFT" };
  }
  const to = nextStage(current, stages);
  if (!to) return { ok: false, error: "No further stage" };
  const verb = current === "DRAFT" ? "SUBMIT" : to === "PUBLISHED" ? "PUBLISH" : "ADVANCE";
  return { ok: true, verb, to };
}
