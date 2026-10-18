import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { createHash, randomBytes } from "node:crypto";
import { cache } from "react";
import { db } from "../db";
import { isProd } from "../env";
import type { Actor } from "../authz";
import type { Role } from "../workflow";

const COOKIE = isProd ? "__Host-buk_session" : "buk_session";
const IDLE_MINUTES: Record<"student" | "staff", number> = { student: 120, staff: 30 };
const ABSOLUTE_HOURS = 12;

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

export async function clientIp(): Promise<string | null> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || null;
}

export async function createSession(userId: string, opts: { mfaPassed: boolean }) {
  const token = randomBytes(32).toString("base64url");
  const h = await headers();
  await db.session.create({
    data: {
      tokenHash: sha256(token),
      userId,
      mfaPassed: opts.mfaPassed,
      expiresAt: new Date(Date.now() + ABSOLUTE_HOURS * 3600_000),
      ip: await clientIp(),
      userAgent: h.get("user-agent")?.slice(0, 300) ?? null,
    },
  });
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    maxAge: ABSOLUTE_HOURS * 3600,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) await db.session.deleteMany({ where: { tokenHash: sha256(token) } });
  jar.delete(COOKIE);
}

export interface SessionUser extends Actor {
  username: string;
  displayName: string;
  mfaEnabled: boolean;
  mfaPassed: boolean;
  sessionId: string;
}

/** Resolve the signed-in user once per request. Returns null when signed out. */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const s = await db.session.findUnique({
    where: { tokenHash: sha256(token) },
    include: { user: { include: { student: true, staff: true } } },
  });
  if (!s) return null;
  const u = s.user;
  const idle = IDLE_MINUTES[u.role === "STUDENT" ? "student" : "staff"] * 60_000;
  const now = Date.now();
  if (s.expiresAt.getTime() < now || now - s.lastSeenAt.getTime() > idle || u.status !== "ACTIVE") {
    await db.session.delete({ where: { id: s.id } }).catch(() => undefined);
    return null;
  }
  // Touch at most once a minute to limit writes.
  if (now - s.lastSeenAt.getTime() > 60_000) {
    await db.session.update({ where: { id: s.id }, data: { lastSeenAt: new Date() } });
  }
  const displayName = u.student
    ? `${u.student.firstName} ${u.student.surname}`
    : u.staff
      ? [u.staff.title, u.staff.firstName, u.staff.surname].filter(Boolean).join(" ")
      : u.username;
  return {
    userId: u.id,
    role: u.role as Role,
    username: u.username,
    displayName,
    studentId: u.student?.id ?? null,
    staffId: u.staff?.id ?? null,
    departmentId: u.staff?.departmentId ?? null,
    mfaEnabled: u.mfaEnabled,
    mfaPassed: s.mfaPassed,
    sessionId: s.id,
  };
});

/** Page/action guard. Redirects instead of rendering anything for the wrong role. */
export async function requireUser(roles?: Role[]): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role !== "STUDENT" && user.mfaEnabled && !user.mfaPassed) redirect("/login/mfa");
  if (roles && !roles.includes(user.role)) redirect(user.role === "STUDENT" ? "/student" : "/staff");
  return user;
}

export const STAFF_ROLES: Role[] = ["LECTURER", "DEPT_RESULT_OFFICER", "HOD", "FACULTY_ADMIN", "SUPER_ADMIN"];
