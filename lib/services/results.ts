import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "../db";
import { audit } from "../audit";
import { assertCan, can, ForbiddenError, type Actor, type OfferingFacts } from "../authz";
import { activePolicy, workflowStages } from "../settings";
import { validateRows, type AcceptedRow, type RawRow, type ValidationResult } from "../import/validate";
import { planTransition, STAGE_LABEL, type Stage } from "../workflow";
import { recomputeStudents } from "./snapshots";
import { notifyMany } from "./notify";

type Tx = Prisma.TransactionClient;

// ─── Loading & permission facts ──────────────────────────────────────────────

async function loadOffering(offeringId: string) {
  const o = await db.courseOffering.findUnique({
    where: { id: offeringId },
    include: {
      course: { include: { department: true } },
      semester: { include: { session: true } },
      assignments: { include: { staff: true } },
      submission: true,
    },
  });
  if (!o) throw new ForbiddenError(); // never reveal existence
  return o;
}

const factsOf = (o: Awaited<ReturnType<typeof loadOffering>>): OfferingFacts => ({
  departmentId: o.course.departmentId,
  assignedStaffIds: o.assignments.map((a) => a.staffId),
});

async function ensureSubmission(offeringId: string) {
  return db.resultSubmission.upsert({ where: { offeringId }, create: { offeringId }, update: {} });
}

// ─── Lists for staff dashboards ──────────────────────────────────────────────

export async function listOfferingsFor(actor: Actor) {
  const where: Prisma.CourseOfferingWhereInput =
    actor.role === "LECTURER"
      ? { assignments: { some: { staffId: actor.staffId ?? "__none__" } } }
      : actor.role === "DEPT_RESULT_OFFICER" || actor.role === "HOD"
        ? { course: { departmentId: actor.departmentId ?? "__none__" } }
        : actor.role === "FACULTY_ADMIN"
          ? {}
          : { id: "__none__" };

  const offerings = await db.courseOffering.findMany({
    where,
    include: {
      course: true,
      semester: { include: { session: true } },
      submission: true,
      _count: { select: { registrations: true } },
    },
    orderBy: [{ semester: { session: { startYear: "desc" } } }, { semester: { number: "desc" } }, { course: { code: "asc" } }],
    take: 200,
  });
  return offerings.map((o) => ({
    id: o.id,
    code: o.course.code,
    title: o.course.title,
    units: o.course.units,
    semesterLabel: `${o.semester.session.name} · ${o.semester.number === 1 ? "First" : "Second"}`,
    students: o._count.registrations,
    stage: (o.submission?.stage ?? "DRAFT") as Stage,
    stageLabel: STAGE_LABEL[(o.submission?.stage ?? "DRAFT") as Stage],
    isCorrection: o.submission?.isCorrection ?? false,
  }));
}

/** Submissions waiting on this actor (review queue). */
export async function reviewQueue(actor: Actor) {
  const all = await listOfferingsFor(actor);
  const stages = await workflowStages();
  return all.filter((o) => planTransition({ current: o.stage, action: "forward", role: actor.role, stages }).ok && o.stage !== "DRAFT");
}

// ─── Offering detail (class list with the editable version of each result) ──

export async function getOfferingDetail(actor: Actor, offeringId: string) {
  const o = await loadOffering(offeringId);
  assertCan(actor, { type: "offering.view", offering: factsOf(o) });
  const sub = o.submission ?? (await ensureSubmission(offeringId));
  const stage = sub.stage as Stage;

  const regs = await db.courseRegistration.findMany({
    where: { offeringId },
    include: { student: true, results: { orderBy: { version: "desc" }, take: 2 } },
    orderBy: { student: { matricNo: "asc" } },
  });

  const rows = regs.map((r) => {
    const current = r.results[0] ?? null;
    return {
      registrationId: r.id,
      matricNo: r.student.matricNo,
      name: `${r.student.surname}, ${r.student.firstName}`,
      attempt: r.attempt,
      ca: current?.caScore != null ? Number(current.caScore) : null,
      exam: current?.examScore != null ? Number(current.examScore) : null,
      total: current?.totalScore != null ? Number(current.totalScore) : null,
      grade: current?.grade ?? null,
      gradePoint: current?.gradePoint ?? null,
      outcome: current?.outcome ?? null,
      status: current?.status ?? null,
      // During a correction, show what students currently see for comparison.
      publishedTotal:
        r.results[1]?.status === "PUBLISHED" && r.results[1]?.totalScore != null ? Number(r.results[1].totalScore) : null,
    };
  });

  const graded = rows.filter((r) => r.gradePoint != null);
  const distribution = ["A", "B", "C", "D", "E", "F"].map((g) => ({ grade: g, count: graded.filter((r) => r.grade === g).length }));

  const actions = await db.approvalAction.findMany({
    where: { submissionId: sub.id },
    include: { actor: { include: { staff: true } } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const stages = await workflowStages();
  return {
    offering: {
      id: o.id,
      code: o.course.code,
      title: o.course.title,
      units: o.course.units,
      caMax: o.course.caMax,
      examMax: o.course.examMax,
      department: o.course.department.name,
      sessionName: o.semester.session.name,
      semesterNumber: o.semester.number,
      lecturers: o.assignments.map((a) => [a.staff.title, a.staff.firstName, a.staff.surname].filter(Boolean).join(" ")),
    },
    stage,
    stageLabel: STAGE_LABEL[stage],
    stages,
    isCorrection: sub.isCorrection,
    canEdit: can(actor, { type: "offering.editScores", offering: factsOf(o), stage }),
    canForward: planTransition({ current: stage, action: "forward", role: actor.role, stages }).ok,
    canReturn: stage !== "DRAFT" && stage !== "PUBLISHED" && planTransition({ current: stage, action: "return", role: actor.role, stages, reason: "x".repeat(10) }).ok,
    canRequestCorrection: stage === "PUBLISHED" && actor.role === "FACULTY_ADMIN",
    rows,
    stats: {
      total: rows.length,
      entered: rows.filter((r) => r.status != null).length,
      missing: rows.filter((r) => r.status == null).length,
      passRate: graded.length ? Math.round((graded.filter((r) => (r.gradePoint ?? 0) > 0).length / graded.length) * 100) : null,
      mean: graded.length ? Math.round((graded.reduce((s, r) => s + (r.total ?? 0), 0) / graded.length) * 10) / 10 : null,
      distribution,
    },
    history: actions.map((a) => ({
      at: a.createdAt,
      verb: a.verb,
      from: STAGE_LABEL[a.fromStage as Stage],
      to: STAGE_LABEL[a.toStage as Stage],
      by: a.actor.staff ? `${a.actor.staff.firstName} ${a.actor.staff.surname}` : a.actor.username,
      reason: a.reason,
    })),
  };
}

// ─── Writing scores (manual grid and imports share this) ─────────────────────

/**
 * Upsert the editable version for each registration. If the newest version is
 * already PUBLISHED (correction in progress), a new version is created; the
 * published row is untouched until the correction itself is published.
 */
async function writeScores(tx: Tx, rows: AcceptedRow[], units: number, gradeScaleId: string) {
  for (const r of rows) {
    const latest = await tx.result.findFirst({ where: { registrationId: r.registrationId }, orderBy: { version: "desc" } });
    const data = {
      caScore: r.ca,
      examScore: r.exam,
      totalScore: r.total,
      grade: r.grade,
      gradePoint: r.gradePoint,
      outcome: r.outcome,
      units,
      gradeScaleId,
      status: "DRAFT" as const,
    };
    if (latest && latest.status === "DRAFT") {
      await tx.result.update({ where: { id: latest.id }, data });
    } else if (!latest || latest.status === "PUBLISHED" || latest.status === "WITHHELD") {
      await tx.result.create({ data: { ...data, registrationId: r.registrationId, version: (latest?.version ?? 0) + 1 } });
    } else {
      throw new ForbiddenError("A result in review cannot be edited");
    }
  }
}

async function importContext(offeringId: string) {
  const o = await loadOffering(offeringId);
  const regs = await db.courseRegistration.findMany({
    where: { offeringId },
    include: { student: true, results: { orderBy: { version: "desc" }, take: 1 } },
  });
  const { id: scaleId, policy } = await activePolicy();
  const sub = o.submission;
  const inCorrection = sub?.isCorrection ?? false;
  return {
    o,
    scaleId,
    ctx: {
      course: { code: o.course.code, caMax: o.course.caMax, examMax: o.course.examMax, units: o.course.units },
      sessionName: o.semester.session.name,
      semesterNumber: o.semester.number,
      registrations: new Map(
        regs.map((r) => {
          const st = r.results[0]?.status;
          // Locked: in review, or published outside a correction window.
          const locked = st === "IN_REVIEW" || ((st === "PUBLISHED" || st === "WITHHELD") && !inCorrection);
          return [r.student.matricNo.toUpperCase(), { registrationId: r.id, locked }];
        }),
      ),
      policy,
    },
  };
}

export async function validateImport(actor: Actor, offeringId: string, rows: RawRow[]): Promise<ValidationResult> {
  const { o, ctx } = await importContext(offeringId);
  assertCan(actor, { type: "offering.editScores", offering: factsOf(o), stage: (o.submission?.stage ?? "DRAFT") as string });
  return validateRows(rows, ctx);
}

/**
 * Commit an import. Re-validates server-side (never trusts the preview the
 * browser sends back) and writes everything in one transaction.
 */
export async function commitImport(
  actor: Actor,
  offeringId: string,
  file: { rows: RawRow[]; sha256: string; fileName: string },
  ip: string | null,
) {
  const { o, ctx, scaleId } = await importContext(offeringId);
  assertCan(actor, { type: "offering.editScores", offering: factsOf(o), stage: (o.submission?.stage ?? "DRAFT") as string });
  const v = validateRows(file.rows, ctx);
  if (v.fileErrors.length) throw new Error(v.fileErrors.join(" "));
  if (v.accepted.length === 0) throw new Error("No valid rows to save.");

  await ensureSubmission(offeringId);
  await db.$transaction(
    async (tx) => {
      await writeScores(tx, v.accepted, o.course.units, scaleId);
      const batch = await tx.importBatch.create({
        data: {
          offeringId,
          uploaderId: actor.userId,
          fileName: file.fileName,
          fileSha256: file.sha256,
          acceptedRows: v.accepted.length,
          rejectedRows: v.rejected.length,
          rejections: v.rejected as unknown as Prisma.InputJsonValue,
        },
      });
      await audit(
        { actorId: actor.userId, action: "result.import", entity: "CourseOffering", entityId: offeringId, after: { batchId: batch.id, accepted: v.accepted.length, rejected: v.rejected.length, sha256: file.sha256 }, ip },
        tx,
      );
    },
    { timeout: 60_000 },
  );
  return v;
}

/** Manual grid save. Same validation as file imports. */
export async function saveManualScores(
  actor: Actor,
  offeringId: string,
  entries: Array<{ matricNo: string; ca: string; exam: string }>,
  ip: string | null,
) {
  const { o, ctx, scaleId } = await importContext(offeringId);
  assertCan(actor, { type: "offering.editScores", offering: factsOf(o), stage: (o.submission?.stage ?? "DRAFT") as string });
  const rows: RawRow[] = entries
    .filter((e) => e.ca.trim() !== "" || e.exam.trim() !== "")
    .map((e) => ({
      matric_no: e.matricNo,
      course_code: o.course.code,
      session: o.semester.session.name,
      semester: String(o.semester.number),
      ca_score: e.ca,
      exam_score: e.exam,
    }));
  if (rows.length === 0) return { accepted: [], rejected: [], missing: [], fileErrors: [] } satisfies ValidationResult;
  const v = validateRows(rows, ctx);
  if (v.accepted.length) {
    await ensureSubmission(offeringId);
    await db.$transaction(async (tx) => {
      await writeScores(tx, v.accepted, o.course.units, scaleId);
      await audit({ actorId: actor.userId, action: "result.manualSave", entity: "CourseOffering", entityId: offeringId, after: { saved: v.accepted.length }, ip }, tx);
    });
  }
  return v;
}

// ─── Workflow transitions ────────────────────────────────────────────────────

export async function transition(
  actor: Actor,
  offeringId: string,
  action: "forward" | "return",
  reason: string | undefined,
  ip: string | null,
) {
  const o = await loadOffering(offeringId);
  const facts = factsOf(o);
  const sub = o.submission ?? (await ensureSubmission(offeringId));
  const current = sub.stage as Stage;

  // Scope check first, then the workflow rule.
  const scoped =
    current === "DRAFT" ? can(actor, { type: "offering.editScores", offering: facts, stage: "DRAFT" }) : can(actor, { type: "offering.review", offering: facts });
  if (!scoped) throw new ForbiddenError();

  const plan = planTransition({ current, action, role: actor.role, stages: await workflowStages(), reason });
  if (!plan.ok) throw new Error(plan.error);

  const editableIds = (
    await db.result.findMany({
      where: { registration: { offeringId }, status: { in: ["DRAFT", "IN_REVIEW"] } },
      select: { id: true },
    })
  ).map((r) => r.id);

  if (plan.verb === "SUBMIT") {
    const regCount = await db.courseRegistration.count({ where: { offeringId } });
    const withResult = await db.courseRegistration.count({ where: { offeringId, results: { some: {} } } });
    if (!sub.isCorrection && withResult < regCount) {
      throw new Error(`${regCount - withResult} registered student(s) have no score. Enter a score or ABS for every student before submitting.`);
    }
    if (editableIds.length === 0) throw new Error("There are no draft results to submit.");
  }

  const affectedStudents: string[] = [];

  await db.$transaction(
    async (tx) => {
      // Optimistic concurrency: the stage must still be what we read.
      const updated = await tx.resultSubmission.updateMany({ where: { id: sub.id, stage: current }, data: { stage: plan.to } });
      if (updated.count !== 1) throw new Error("This submission changed while you were viewing it. Reload and try again.");

      if (plan.verb === "SUBMIT") {
        await tx.result.updateMany({ where: { id: { in: editableIds } }, data: { status: "IN_REVIEW" } });
      } else if (plan.verb === "RETURN") {
        await tx.result.updateMany({ where: { id: { in: editableIds } }, data: { status: "DRAFT" } });
      } else if (plan.verb === "PUBLISH") {
        const now = new Date();
        const newRows = await tx.result.findMany({
          where: { id: { in: editableIds } },
          include: { registration: true },
        });
        for (const r of newRows) {
          // Supersede the previously published version, keeping it for history.
          const old = await tx.result.findFirst({
            where: { registrationId: r.registrationId, status: { in: ["PUBLISHED", "WITHHELD"] }, version: { lt: r.version } },
          });
          if (old) {
            await tx.result.update({ where: { id: old.id }, data: { status: "SUPERSEDED", supersededAt: now } });
            await audit(
              {
                actorId: actor.userId, action: "result.correct", entity: "Result", entityId: r.id,
                before: { version: old.version, total: old.totalScore?.toString() ?? null, grade: old.grade },
                after: { version: r.version, total: r.totalScore?.toString() ?? null, grade: r.grade },
                ip,
              },
              tx,
            );
          }
          affectedStudents.push(r.registration.studentId);
        }
        await tx.result.updateMany({ where: { id: { in: editableIds } }, data: { status: "PUBLISHED", publishedAt: now } });
        await tx.resultSubmission.update({ where: { id: sub.id }, data: { isCorrection: false } });
      }

      await tx.approvalAction.create({
        data: { submissionId: sub.id, verb: plan.verb, fromStage: current, toStage: plan.to, actorId: actor.userId, reason: reason?.trim() || null },
      });
      await audit({ actorId: actor.userId, action: `submission.${plan.verb.toLowerCase()}`, entity: "ResultSubmission", entityId: sub.id, before: { stage: current }, after: { stage: plan.to }, ip }, tx);

      if (affectedStudents.length) await recomputeStudents(tx, [...new Set(affectedStudents)]);
    },
    { timeout: 120_000 },
  );

  // Notifications after commit (best-effort; failures don't undo publication).
  if (plan.verb === "PUBLISH") {
    const users = await db.studentProfile.findMany({ where: { id: { in: affectedStudents } }, select: { userId: true } });
    await notifyMany(
      users.map((u) => u.userId),
      sub.isCorrection
        ? { title: `Corrected result: ${o.course.code}`, body: "A corrected result has been published. Sign in to view it.", href: "/student/results" }
        : { title: `New result: ${o.course.code}`, body: `Your ${o.course.code} result has been published.`, href: "/student/results" },
    );
  } else {
    const staffUsers = await db.staffProfile.findMany({ where: { id: { in: facts.assignedStaffIds } }, select: { userId: true } });
    await notifyMany(staffUsers.map((s) => s.userId), {
      title: `${o.course.code}: ${STAGE_LABEL[plan.to]}`,
      body: plan.verb === "RETURN" ? `Returned for correction: ${reason}` : `Moved to “${STAGE_LABEL[plan.to]}”.`,
      href: `/staff/courses/${offeringId}`,
    });
  }
  return plan;
}

/** Re-open a published course for an authorised correction (Faculty Admin). */
export async function openCorrection(actor: Actor, offeringId: string, reason: string, ip: string | null) {
  if (actor.role !== "FACULTY_ADMIN") throw new ForbiddenError();
  if (!reason || reason.trim().length < 20) throw new Error("Give a reason of at least 20 characters (what is wrong and the evidence).");
  const o = await loadOffering(offeringId);
  const sub = o.submission;
  if (!sub || sub.stage !== "PUBLISHED") throw new Error("Only published results can be corrected.");
  await db.$transaction(async (tx) => {
    const updated = await tx.resultSubmission.updateMany({ where: { id: sub.id, stage: "PUBLISHED" }, data: { stage: "DRAFT", isCorrection: true } });
    if (updated.count !== 1) throw new Error("This submission changed. Reload and try again.");
    await tx.approvalAction.create({ data: { submissionId: sub.id, verb: "REOPEN_FOR_CORRECTION", fromStage: "PUBLISHED", toStage: "DRAFT", actorId: actor.userId, reason: reason.trim() } });
    await audit({ actorId: actor.userId, action: "submission.reopen", entity: "ResultSubmission", entityId: sub.id, after: { reason: reason.trim() }, ip }, tx);
  });
}
