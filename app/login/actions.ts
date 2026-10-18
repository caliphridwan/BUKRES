"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { authenticator } from "otplib";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { hashSecret, passwordProblems, verifySecret } from "@/lib/auth/password";
import { clientIp, createSession, destroySession, getSessionUser } from "@/lib/auth/session";
import { clear, hit, LIMITS } from "@/lib/auth/rate-limit";

export type FormState = { error?: string; ok?: string; fields?: Record<string, string> } | undefined;

const GENERIC = "The matric/staff number or password is incorrect.";

const loginSchema = z.object({
  username: z.string().trim().min(3).max(40).transform((s) => s.toUpperCase()),
  password: z.string().min(1).max(128),
  as: z.enum(["student", "staff"]),
});

export async function login(_: FormState, form: FormData): Promise<FormState> {
  const parsed = loginSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "Enter your number and password." };
  const { username, password, as } = parsed.data;
  const ip = await clientIp();

  const perIp = await hit(`ip:${ip ?? "unknown"}`, LIMITS.loginPerIp.limit, LIMITS.loginPerIp.windowMs);
  const perUser = await hit(`user:${username}`, LIMITS.loginPerAccount.limit, LIMITS.loginPerAccount.windowMs);
  if (perIp.limited || perUser.limited) {
    await audit({ action: "auth.login.rateLimited", entity: "User", entityId: username, ip });
    const mins = Math.ceil(Math.max(perIp.retryAfterSec, perUser.retryAfterSec) / 60);
    return { error: `Too many attempts. Try again in about ${mins} minute${mins === 1 ? "" : "s"}.`, fields: { username } };
  }

  const user = await db.user.findUnique({ where: { username } });
  const roleOk = user && (as === "student" ? user.role === "STUDENT" : user.role !== "STUDENT");
  const pwOk = await verifySecret(roleOk ? user!.passwordHash : null, password);

  if (!user || !roleOk || !pwOk) {
    await audit({ actorId: user?.id ?? null, action: "auth.login.failed", entity: "User", entityId: username, ip });
    return { error: GENERIC, fields: { username } };
  }
  if (user.status === "PENDING_ACTIVATION") return { error: "This account is not activated yet. Use your activation code first.", fields: { username } };
  if (user.status === "SUSPENDED") return { error: "This account is suspended. Contact the Faculty office.", fields: { username } };

  await clear(`user:${username}`);
  await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await createSession(user.id, { mfaPassed: !user.mfaEnabled });
  await audit({ actorId: user.id, action: "auth.login.success", entity: "User", entityId: user.id, ip });

  if (user.role !== "STUDENT" && user.mfaEnabled) redirect("/login/mfa");
  redirect(user.role === "STUDENT" ? "/student" : "/staff");
}

export async function verifyMfa(_: FormState, form: FormData): Promise<FormState> {
  const me = await getSessionUser();
  if (!me) redirect("/login");
  const code = String(form.get("code") ?? "").replace(/\s/g, "");
  const ip = await clientIp();
  const limited = await hit(`mfa:${me.userId}`, 5, 15 * 60_000);
  if (limited.limited) return { error: "Too many attempts. Sign in again later." };
  const user = await db.user.findUniqueOrThrow({ where: { id: me.userId } });
  if (!user.mfaSecret || !authenticator.check(code, user.mfaSecret)) {
    await audit({ actorId: me.userId, action: "auth.mfa.failed", ip });
    return { error: "That code is not valid. Check your authenticator app and try again." };
  }
  await db.session.update({ where: { id: me.sessionId }, data: { mfaPassed: true } });
  await audit({ actorId: me.userId, action: "auth.mfa.success", ip });
  redirect("/staff");
}

const activateSchema = z
  .object({
    username: z.string().trim().min(3).max(40).transform((s) => s.toUpperCase()),
    code: z.string().trim().min(6).max(20).transform((s) => s.toUpperCase()),
    email: z.string().trim().email("Enter a valid email address").max(120),
    password: z.string(),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, { message: "The passwords do not match.", path: ["confirm"] });

export async function activate(_: FormState, form: FormData): Promise<FormState> {
  const parsed = activateSchema.safeParse(Object.fromEntries(form));
  const fields = { username: String(form.get("username") ?? ""), email: String(form.get("email") ?? "") };
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form.", fields };
  const { username, code, email, password } = parsed.data;
  const ip = await clientIp();

  const limited = await hit(`activate:${ip ?? "unknown"}`, LIMITS.activationPerIp.limit, LIMITS.activationPerIp.windowMs);
  if (limited.limited) return { error: "Too many attempts. Try again later.", fields };

  const problems = passwordProblems(password, username);
  if (problems.length) return { error: problems.join(" "), fields };

  const user = await db.user.findUnique({ where: { username } });
  const valid =
    user &&
    user.status === "PENDING_ACTIVATION" &&
    (!user.activationExpires || user.activationExpires > new Date()) &&
    (await verifySecret(user.activationCodeHash, code));
  if (!user || !valid) {
    await audit({ actorId: user?.id ?? null, action: "auth.activate.failed", entity: "User", entityId: username, ip });
    return { error: "The number or activation code is not valid, or the code has expired.", fields };
  }
  const emailTaken = await db.user.findFirst({ where: { email, NOT: { id: user.id } } });
  if (emailTaken) return { error: "That email address is already linked to another account.", fields };

  await db.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await hashSecret(password),
      email,
      // Email verification link would be sent here; until clicked, recovery goes via the Faculty office.
      emailVerifiedAt: null,
      status: "ACTIVE",
      activationCodeHash: null,
      activationExpires: null,
    },
  });
  await audit({ actorId: user.id, action: "auth.activate.success", entity: "User", entityId: user.id, ip });
  await createSession(user.id, { mfaPassed: !user.mfaEnabled });
  redirect(user.role === "STUDENT" ? "/student" : "/staff");
}

export async function logout() {
  const me = await getSessionUser();
  if (me) await audit({ actorId: me.userId, action: "auth.logout", ip: await clientIp() });
  await destroySession();
  redirect("/login");
}

const changeSchema = z.object({ current: z.string().min(1), password: z.string(), confirm: z.string() });

export async function changePassword(_: FormState, form: FormData): Promise<FormState> {
  const me = await getSessionUser();
  if (!me) redirect("/login");
  const parsed = changeSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "Fill in all fields." };
  const { current, password, confirm } = parsed.data;
  if (password !== confirm) return { error: "The new passwords do not match." };
  const problems = passwordProblems(password, me.username);
  if (problems.length) return { error: problems.join(" ") };
  const user = await db.user.findUniqueOrThrow({ where: { id: me.userId } });
  if (!(await verifySecret(user.passwordHash, current))) return { error: "Your current password is incorrect." };
  await db.$transaction([
    db.user.update({ where: { id: me.userId }, data: { passwordHash: await hashSecret(password) } }),
    // Sign out every other session.
    db.session.deleteMany({ where: { userId: me.userId, NOT: { id: me.sessionId } } }),
    db.notification.create({ data: { userId: me.userId, title: "Password changed", body: "Your password was changed and other devices were signed out." } }),
  ]);
  await audit({ actorId: me.userId, action: "auth.password.changed", ip: await clientIp() });
  return { ok: "Password changed. Other devices have been signed out." };
}
