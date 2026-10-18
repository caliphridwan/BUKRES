import "server-only";
import { db } from "../db";
import { formatGpa } from "../grading/engine";
import { VERIFICATION_CODE_RE as CODE_RE } from "../verification-code";

/** Mask "Abdulkareem" → "Ab*********m". */
const mask = (s: string) => (s.length <= 2 ? s[0] + "*" : s.slice(0, 2) + "*".repeat(Math.max(s.length - 3, 1)) + s.slice(-1));

/**
 * Public verification: minimum disclosure (spec §7). No scores, no course
 * list, no contact details, no date of birth.
 */
export async function verifyStatement(rawCode: string) {
  const code = rawCode.trim().toUpperCase();
  if (!CODE_RE.test(code)) return null;
  const st = await db.statement.findUnique({
    where: { code },
    include: {
      student: { include: { programme: true } },
      semester: { include: { session: true } },
      snapshot: { include: { semester: { include: { session: true } } } },
    },
  });
  if (!st) return null;
  const sem = st.semester ?? st.snapshot.semester;
  return {
    status: st.status,
    type: st.type,
    issuedAt: st.issuedAt,
    name: `${st.student.firstName} ${mask(st.student.surname)}`,
    programme: st.student.programme.name,
    period: `${sem.session.name} · ${sem.number === 1 ? "First" : "Second"} Semester`,
    cgpa: formatGpa(Number(st.snapshot.cgpa)),
  };
}
