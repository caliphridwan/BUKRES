import { createHash } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { computeHistory, semesterOrder, type Attempt } from "../grading/engine";
import { policyFromRow } from "../grading/policy";

type Tx = Prisma.TransactionClient;

/**
 * Recalculate GPA snapshots for the given students inside the caller's
 * transaction. A snapshot is only written when its inputs changed; the old one
 * is marked superseded and statements issued from it stop verifying as valid.
 */
export async function recomputeStudents(tx: Tx, studentIds: string[]) {
  const scale = await tx.gradeScale.findFirst({ where: { isActive: true }, orderBy: { version: "desc" } });
  if (!scale) throw new Error("No active grade scale");
  const policy = policyFromRow(scale);
  const now = new Date();

  for (const studentId of studentIds) {
    const regs = await tx.courseRegistration.findMany({
      where: { studentId },
      include: {
        offering: { include: { course: true, semester: { include: { session: true } } } },
        results: { where: { status: { in: ["PUBLISHED", "WITHHELD"] } }, orderBy: { version: "desc" }, take: 1 },
      },
    });

    const attempts: Array<Attempt & { resultKey: string; semesterId: string }> = [];
    for (const reg of regs) {
      const r = reg.results[0];
      if (!r) continue;
      const sem = reg.offering.semester;
      const excluded = r.status === "WITHHELD" || r.outcome !== "GRADED";
      attempts.push({
        courseCode: reg.offering.course.code,
        units: r.units,
        gradePoint: excluded ? null : r.gradePoint,
        passed: excluded || r.gradePoint == null ? null : r.gradePoint > 0,
        outcome: r.outcome,
        status: r.status,
        semesterOrder: semesterOrder(sem.session.startYear, sem.number),
        attemptNo: reg.attempt,
        resultKey: `${r.id}:${r.version}:${r.status}`,
        semesterId: sem.id,
      });
    }

    const history = computeHistory(attempts, policy);
    for (const h of history) {
      if (h.semester.gpa == null && h.cumulative.gpa == null) continue;
      const semesterId = attempts.find((a) => a.semesterOrder === h.semesterOrder)!.semesterId;
      // Cumulative inputs determine the snapshot, so hash everything up to this semester.
      const keys = attempts.filter((a) => a.semesterOrder <= h.semesterOrder).map((a) => a.resultKey).sort();
      const inputHash = createHash("sha256").update(`${scale.id}|${keys.join(",")}`).digest("hex");

      const current = await tx.gpaSnapshot.findFirst({ where: { studentId, semesterId, supersededAt: null } });
      if (current?.inputHash === inputHash) continue;
      if (current) {
        await tx.gpaSnapshot.update({ where: { id: current.id }, data: { supersededAt: now } });
        await tx.statement.updateMany({ where: { snapshotId: current.id, status: "VALID" }, data: { status: "SUPERSEDED" } });
      }
      await tx.gpaSnapshot.create({
        data: {
          studentId,
          semesterId,
          gradeScaleId: scale.id,
          semesterUnits: h.semester.units,
          semesterQP: h.semester.qualityPoints,
          semesterGpa: h.semester.gpa ?? 0,
          cumulativeUnits: h.cumulative.units,
          cumulativeQP: h.cumulative.qualityPoints,
          cgpa: h.cumulative.gpa ?? 0,
          unitsEarned: h.unitsEarned,
          inputHash,
        },
      });
    }
  }
}
