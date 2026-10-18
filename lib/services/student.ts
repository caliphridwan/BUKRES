import "server-only";
import { db } from "../db";
import { activePolicy, getSetting } from "../settings";
import {
  computeHistory,
  gpaTrend,
  semesterOrder,
  type Attempt,
  type SemesterSummary,
} from "../grading/engine";

export interface ResultLine {
  courseCode: string;
  title: string;
  units: number;
  score: number | null;
  grade: string | null;
  gradePoint: number | null;
  qualityPoints: number | null;
  status: "Passed" | "Failed" | "Absent" | "Incomplete" | "Withheld" | "Pending";
  attempt: number;
  note?: string;
}

export interface SemesterView {
  semesterId: string;
  sessionName: string;
  semesterNumber: number;
  label: string;
  order: number;
  publishedAt: Date | null;
  lines: ResultLine[];
  summary: SemesterSummary | null;
  previous: { units: number; qualityPoints: number } | null;
  hasPending: boolean;
}

/**
 * Everything a student may see about their own record. The student id comes
 * from the session — callers never pass an id taken from the request.
 * Unpublished results contribute nothing except a "Pending" line.
 */
export async function getStudentRecord(studentId: string) {
  const student = await db.studentProfile.findUniqueOrThrow({
    where: { id: studentId },
    include: { programme: { include: { department: true } } },
  });

  const [regs, { policy }, showScores, currentSession] = await Promise.all([
    db.courseRegistration.findMany({
      where: { studentId },
      include: {
        offering: { include: { course: true, semester: { include: { session: true } } } },
        results: { where: { status: { not: "SUPERSEDED" } }, orderBy: { version: "desc" } },
      },
    }),
    activePolicy(),
    getSetting("SHOW_RAW_SCORES"),
    db.academicSession.findFirst({ where: { isCurrent: true } }),
  ]);

  const attempts: Attempt[] = [];
  const bySemester = new Map<string, SemesterView>();

  for (const reg of regs) {
    const sem = reg.offering.semester;
    const order = semesterOrder(sem.session.startYear, sem.number);
    let view = bySemester.get(sem.id);
    if (!view) {
      view = {
        semesterId: sem.id,
        sessionName: sem.session.name,
        semesterNumber: sem.number,
        label: `${sem.session.name} · ${sem.number === 1 ? "First" : "Second"} Semester`,
        order,
        publishedAt: null,
        lines: [],
        summary: null,
        previous: null,
        hasPending: false,
      };
      bySemester.set(sem.id, view);
    }

    // The student-visible version: the newest PUBLISHED/WITHHELD row.
    // A newer draft under correction is invisible; the old published row stays.
    const visible = reg.results.find((r) => r.status === "PUBLISHED" || r.status === "WITHHELD");
    const course = reg.offering.course;

    if (!visible) {
      view.hasPending = true;
      view.lines.push({
        courseCode: course.code, title: course.title, units: course.units, score: null, grade: null,
        gradePoint: null, qualityPoints: null, status: "Pending", attempt: reg.attempt,
      });
      continue;
    }

    if (visible.publishedAt && (!view.publishedAt || visible.publishedAt > view.publishedAt)) {
      view.publishedAt = visible.publishedAt;
    }

    const withheld = visible.status === "WITHHELD";
    const absent = visible.outcome === "ABSENT";
    const incomplete = visible.outcome === "INCOMPLETE";
    const point = withheld || absent || incomplete ? null : visible.gradePoint;
    const passed = point == null ? null : point > 0;

    attempts.push({
      courseCode: course.code,
      units: visible.units,
      gradePoint: point,
      passed,
      outcome: visible.outcome,
      status: visible.status,
      semesterOrder: order,
      attemptNo: reg.attempt,
    });

    view.lines.push({
      courseCode: course.code,
      title: course.title,
      units: visible.units,
      score: withheld || !showScores || visible.totalScore == null ? null : Number(visible.totalScore),
      grade: withheld ? null : visible.grade,
      gradePoint: point,
      qualityPoints: point == null ? null : point * visible.units,
      status: withheld ? "Withheld" : absent ? "Absent" : incomplete ? "Incomplete" : passed ? "Passed" : "Failed",
      attempt: reg.attempt,
      note: withheld ? visible.withheldReason ?? "Administrative hold" : reg.attempt > 1 ? "Carryover" : undefined,
    });
  }

  const history = computeHistory(attempts, policy);
  const semesters = [...bySemester.values()].sort((a, b) => a.order - b.order);
  let prev: SemesterSummary | null = null;
  for (const s of semesters) {
    s.lines.sort((a, b) => a.courseCode.localeCompare(b.courseCode));
    s.summary = history.find((h) => h.semesterOrder === s.order) ?? null;
    s.previous = prev ? { units: prev.cumulative.units, qualityPoints: prev.cumulative.qualityPoints } : null;
    if (s.summary) prev = s.summary;
  }

  const published = semesters.filter((s) => s.summary && s.summary.semester.gpa != null);
  const latest = published.at(-1) ?? null;

  return {
    student,
    currentSession: currentSession?.name ?? null,
    semesters,
    published,
    latest,
    trend: gpaTrend(history),
    totals: {
      registered: semesters.reduce((n, s) => n + s.lines.reduce((m, l) => m + l.units, 0), 0),
      earned: latest?.summary?.unitsEarned ?? 0,
    },
    policy,
    showScores,
  };
}

export type StudentRecord = Awaited<ReturnType<typeof getStudentRecord>>;
