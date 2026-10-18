import "server-only";
import { z } from "zod";
import { db } from "../db";
import { audit } from "../audit";
import { assertCan, type Actor } from "../authz";
import { hashSecret, newActivationCode } from "../auth/password";

const ACTIVATION_DAYS = 14;

export async function listStudents(actor: Actor, q: string, page: number) {
  assertCan(actor, { type: "admin.manageStudents" });
  const take = 25;
  const where = q
    ? {
        OR: [
          { matricNo: { contains: q.toUpperCase() } },
          { surname: { contains: q, mode: "insensitive" as const } },
          { firstName: { contains: q, mode: "insensitive" as const } },
        ],
      }
    : {};
  const [rows, total] = await Promise.all([
    db.studentProfile.findMany({
      where,
      include: { user: { select: { status: true, lastLoginAt: true } }, programme: true },
      orderBy: { matricNo: "asc" },
      take,
      skip: (page - 1) * take,
    }),
    db.studentProfile.count({ where }),
  ]);
  return { rows, total, pages: Math.max(1, Math.ceil(total / take)) };
}

/**
 * Issue (or reissue) a one-time activation code. The plain code is returned
 * once for printing/handing over and never stored. Reissuing also resets the
 * password and signs the user out — this doubles as the recovery path.
 */
export async function issueActivationCode(actor: Actor, studentId: string, ip: string | null) {
  assertCan(actor, { type: "admin.manageStudents" });
  const st = await db.studentProfile.findUniqueOrThrow({ where: { id: studentId } });
  const code = newActivationCode();
  await db.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: st.userId },
      data: {
        activationCodeHash: await hashSecret(code),
        activationExpires: new Date(Date.now() + ACTIVATION_DAYS * 86_400_000),
        status: "PENDING_ACTIVATION",
        passwordHash: null,
      },
    });
    await tx.session.deleteMany({ where: { userId: st.userId } });
    await audit({ actorId: actor.userId, action: "account.activationIssued", entity: "User", entityId: st.userId, ip }, tx);
  });
  return { matricNo: st.matricNo, code, expiresInDays: ACTIVATION_DAYS };
}

export const newStudentSchema = z.object({
  matricNo: z.string().trim().min(5).max(30).transform((s) => s.toUpperCase().replace(/\s+/g, "")),
  surname: z.string().trim().min(1).max(60),
  firstName: z.string().trim().min(1).max(60),
  otherNames: z.string().trim().max(80).optional().transform((s) => s || null),
  programmeId: z.string().min(10),
  entryYear: z.coerce.number().int().min(2000).max(2100),
  currentLevel: z.coerce.number().int().refine((n) => [100, 200, 300, 400, 500].includes(n), "Level must be 100–500"),
});

export async function createStudent(actor: Actor, input: z.infer<typeof newStudentSchema>, ip: string | null) {
  assertCan(actor, { type: "admin.manageStudents" });
  const exists = await db.user.findUnique({ where: { username: input.matricNo } });
  if (exists) throw new Error("A user with that matric number already exists.");
  const user = await db.user.create({
    data: {
      username: input.matricNo,
      role: "STUDENT",
      student: { create: { ...input } },
    },
    include: { student: true },
  });
  await audit({ actorId: actor.userId, action: "account.studentCreated", entity: "User", entityId: user.id, after: { matricNo: input.matricNo }, ip });
  return issueActivationCode(actor, user.student!.id, ip);
}

export async function auditPage(actor: Actor, page: number, action?: string) {
  const scopedToDept = actor.role === "HOD" || actor.role === "DEPT_RESULT_OFFICER";
  assertCan(actor, { type: "audit.view", departmentId: actor.departmentId });
  const take = 50;
  // Department roles see actions taken by staff in their department.
  const where = {
    ...(action ? { action: { startsWith: action } } : {}),
    ...(scopedToDept ? { actor: { staff: { departmentId: actor.departmentId ?? "__none__" } } } : {}),
  };
  const [rows, total] = await Promise.all([
    db.auditLog.findMany({ where, include: { actor: { select: { username: true } } }, orderBy: { createdAt: "desc" }, take, skip: (page - 1) * take }),
    db.auditLog.count({ where }),
  ]);
  return { rows, total, pages: Math.max(1, Math.ceil(total / take)) };
}
