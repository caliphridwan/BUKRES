/**
 * Authorization policy. Every route handler and server action calls `can()`
 * (or `assertCan()`) before touching data — hiding a button is never the
 * control (spec §7). Pure function: the caller loads the facts it needs.
 */
import type { Role } from "./workflow";

export interface Actor {
  userId: string;
  role: Role;
  studentId?: string | null;
  staffId?: string | null;
  departmentId?: string | null;
}

/** Facts about an offering needed for staff checks. */
export interface OfferingFacts {
  departmentId: string;
  assignedStaffIds: string[];
}

export type Action =
  | { type: "student.viewOwn" }
  | { type: "offering.view"; offering: OfferingFacts }
  | { type: "offering.editScores"; offering: OfferingFacts; stage: string }
  | { type: "offering.review"; offering: OfferingFacts }
  | { type: "correction.request"; offering: OfferingFacts }
  | { type: "admin.manageStructure" }
  | { type: "admin.manageStudents" }
  | { type: "admin.manageStaff" }
  | { type: "admin.manageAdmins" }
  | { type: "audit.view"; departmentId?: string | null }
  | { type: "analytics.view"; departmentId?: string | null };

const isStaff = (r: Role) => r !== "STUDENT";

export function can(actor: Actor, action: Action): boolean {
  const { role } = actor;
  switch (action.type) {
    case "student.viewOwn":
      return role === "STUDENT" && !!actor.studentId;

    case "offering.view": {
      if (role === "FACULTY_ADMIN") return true;
      if (role === "LECTURER") return !!actor.staffId && action.offering.assignedStaffIds.includes(actor.staffId);
      if (role === "DEPT_RESULT_OFFICER" || role === "HOD") return actor.departmentId === action.offering.departmentId;
      return false; // SUPER_ADMIN has no academic-record access by default
    }

    case "offering.editScores": {
      if (action.stage !== "DRAFT") return false; // locked once submitted
      if (role === "LECTURER") return !!actor.staffId && action.offering.assignedStaffIds.includes(actor.staffId);
      if (role === "DEPT_RESULT_OFFICER") return actor.departmentId === action.offering.departmentId;
      return false;
    }

    case "offering.review":
      if (role === "FACULTY_ADMIN") return true;
      if (role === "DEPT_RESULT_OFFICER" || role === "HOD") return actor.departmentId === action.offering.departmentId;
      return false;

    case "correction.request":
      if (role === "FACULTY_ADMIN") return true;
      if (role === "LECTURER") return !!actor.staffId && action.offering.assignedStaffIds.includes(actor.staffId);
      if (role === "DEPT_RESULT_OFFICER" || role === "HOD") return actor.departmentId === action.offering.departmentId;
      return false;

    case "admin.manageStructure":
    case "admin.manageStudents":
    case "admin.manageStaff":
      return role === "FACULTY_ADMIN";

    case "admin.manageAdmins":
      return role === "SUPER_ADMIN";

    case "audit.view":
    case "analytics.view":
      if (role === "FACULTY_ADMIN" || role === "SUPER_ADMIN") return true;
      if (role === "DEPT_RESULT_OFFICER" || role === "HOD") return !!action.departmentId && action.departmentId === actor.departmentId;
      return false;
  }
  return false;
}

export class ForbiddenError extends Error {
  constructor(message = "You do not have permission to do that.") {
    super(message);
  }
}

export function assertCan(actor: Actor, action: Action): void {
  if (!can(actor, action)) throw new ForbiddenError();
}

export { isStaff };
