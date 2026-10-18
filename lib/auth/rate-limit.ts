import "server-only";
import { db } from "../db";

/**
 * Sliding-window limiter backed by Postgres so it holds across server
 * instances (no Redis needed for Phase 1). Records an attempt and reports
 * whether the key is over its limit.
 */
export async function hit(key: string, limit: number, windowMs: number): Promise<{ limited: boolean; retryAfterSec: number }> {
  const since = new Date(Date.now() - windowMs);
  const [count] = await db.$transaction([
    db.loginAttempt.count({ where: { key, createdAt: { gte: since } } }),
    db.loginAttempt.create({ data: { key } }),
  ]);
  if (count < limit) return { limited: false, retryAfterSec: 0 };
  const oldest = await db.loginAttempt.findFirst({ where: { key, createdAt: { gte: since } }, orderBy: { createdAt: "asc" } });
  const retry = oldest ? Math.ceil((oldest.createdAt.getTime() + windowMs - Date.now()) / 1000) : windowMs / 1000;
  return { limited: true, retryAfterSec: Math.max(retry, 1) };
}

export async function clear(key: string) {
  await db.loginAttempt.deleteMany({ where: { key } });
}

export const LIMITS = {
  loginPerAccount: { limit: 5, windowMs: 15 * 60_000 },
  loginPerIp: { limit: 20, windowMs: 15 * 60_000 },
  verifyPerIp: { limit: 10, windowMs: 60_000 },
  activationPerIp: { limit: 10, windowMs: 15 * 60_000 },
};
