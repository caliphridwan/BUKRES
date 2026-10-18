import "server-only";
import { hash, verify } from "@node-rs/argon2";
import { randomBytes } from "node:crypto";

// OWASP-recommended Argon2id parameters (19 MiB, 2 iterations, 1 lane).
const OPTS = { memoryCost: 19456, timeCost: 2, parallelism: 1, outputLen: 32 } as const;

export const hashSecret = (plain: string) => hash(plain, OPTS);

export async function verifySecret(stored: string | null | undefined, plain: string): Promise<boolean> {
  if (!stored) {
    // Spend comparable time so missing accounts are not distinguishable by timing.
    await hash(plain, OPTS);
    return false;
  }
  try {
    return await verify(stored, plain);
  } catch {
    return false;
  }
}

/** Password rules shown to users verbatim. */
export function passwordProblems(pw: string, username: string): string[] {
  const problems: string[] = [];
  if (pw.length < 10) problems.push("Use at least 10 characters.");
  if (pw.length > 128) problems.push("Use at most 128 characters.");
  if (pw.toUpperCase().includes(username.toUpperCase())) problems.push("Do not include your matric or staff number.");
  if (/^(.)\1+$/.test(pw)) problems.push("Do not repeat a single character.");
  return problems;
}

/** One-time activation code, e.g. "K7Q4-M2XP-9HTR" (no 0/O/1/I). */
export function newActivationCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(12);
  const chars = [...bytes].map((b) => alphabet[b % alphabet.length]).join("");
  return `${chars.slice(0, 4)}-${chars.slice(4, 8)}-${chars.slice(8, 12)}`;
}
