"use server";

import { revalidatePath } from "next/cache";
import { clientIp, requireUser } from "@/lib/auth/session";
import { createStudent, issueActivationCode, newStudentSchema } from "@/lib/services/admin";

export type CodeState = { matricNo?: string; code?: string; expiresInDays?: number; error?: string } | undefined;

export async function reissueCode(studentId: string, _: CodeState): Promise<CodeState> {
  const me = await requireUser(["FACULTY_ADMIN"]);
  try {
    return await issueActivationCode(me, studentId, await clientIp());
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not issue a code." };
  }
}

export async function addStudent(_: CodeState, form: FormData): Promise<CodeState> {
  const me = await requireUser(["FACULTY_ADMIN"]);
  const parsed = newStudentSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form." };
  try {
    const r = await createStudent(me, parsed.data, await clientIp());
    revalidatePath("/staff/students");
    return r;
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not create the student." };
  }
}
