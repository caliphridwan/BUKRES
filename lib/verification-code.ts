import { randomBytes } from "node:crypto";

// RFC 4648 base32 without padding: 128 bits → 26 characters.
export function newVerificationCode(): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const bytes = randomBytes(16);
  let bits = 0, value = 0, out = "";
  for (const b of bytes) {
    value = (value << 8) | b;
    bits += 8;
    while (bits >= 5) {
      out += alphabet[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += alphabet[(value << (5 - bits)) & 31];
  return out;
}

export const VERIFICATION_CODE_RE = /^[A-Z2-7]{26}$/;
