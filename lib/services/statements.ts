import "server-only";
import { newVerificationCode } from "../verification-code";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import QRCode from "qrcode";
import { db } from "../db";
import { env } from "../env";
import { brand } from "../brand";
import { formatGpa } from "../grading/engine";
import { getStudentRecord, type SemesterView } from "./student";

/**
 * Issue (or reuse) a statement for the signed-in student's own record.
 * `semesterId` null → cumulative statement up to the latest published semester.
 */
export async function issueStatement(studentId: string, semesterId: string | null) {
  const snapshot = await db.gpaSnapshot.findFirst({
    where: { studentId, supersededAt: null, ...(semesterId ? { semesterId } : {}) },
    orderBy: [{ semester: { session: { startYear: "desc" } } }, { semester: { number: "desc" } }],
  });
  if (!snapshot) return null; // nothing published for that semester
  const type = semesterId ? "SEMESTER" : "CUMULATIVE";
  const existing = await db.statement.findFirst({ where: { snapshotId: snapshot.id, type, status: "VALID" } });
  if (existing) return existing;
  return db.statement.create({
    data: { code: newVerificationCode(), type, studentId, semesterId: semesterId ?? null, snapshotId: snapshot.id },
  });
}

// ─── PDF rendering ──────────────────────────────────────────────────────────

const C = {
  ink: rgb(0.09, 0.13, 0.2),
  muted: rgb(0.4, 0.46, 0.55),
  navy: rgb(0.071, 0.231, 0.408),
  rule: rgb(0.85, 0.88, 0.92),
  band: rgb(0.957, 0.969, 0.984),
};

function text(page: PDFPage, s: string, x: number, y: number, font: PDFFont, size = 9, color = C.ink) {
  page.drawText(s, { x, y, size, font, color });
}

export async function renderStatementPdf(studentId: string, semesterId: string | null): Promise<Uint8Array | null> {
  const statement = await issueStatement(studentId, semesterId);
  if (!statement) return null;
  const rec = await getStudentRecord(studentId);
  const semesters: SemesterView[] = semesterId
    ? rec.semesters.filter((s) => s.semesterId === semesterId && s.summary)
    : rec.semesters.filter((s) => s.summary);
  if (semesters.length === 0) return null;

  const pdf = await PDFDocument.create();
  pdf.setTitle(`Result statement ${rec.student.matricNo}`);
  pdf.setProducer(brand.name);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const verifyUrl = `${env.APP_URL}/verify/${statement.code}`;
  const qr = await pdf.embedPng(await QRCode.toBuffer(verifyUrl, { margin: 0, width: 160, errorCorrectionLevel: "M" }));

  const W = 595.28, H = 841.89, M = 42;
  let page = pdf.addPage([W, H]);
  let y = H - M;

  const header = () => {
    page.drawRectangle({ x: 0, y: H - 6, width: W, height: 6, color: C.navy });
    text(page, brand.institution.toUpperCase(), M, y - 8, bold, 11, C.navy);
    text(page, brand.name, M, y - 24, font, 9.5, C.muted);
    const title = statement.type === "SEMESTER" ? "SEMESTER RESULT STATEMENT" : "CUMULATIVE RESULT STATEMENT";
    text(page, title, W - M - bold.widthOfTextAtSize(title, 10), y - 8, bold, 10);
    y -= 46;
    page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.8, color: C.rule });
    y -= 16;
  };
  header();

  // Student block
  const s = rec.student;
  const kv: Array<[string, string]> = [
    ["Name", `${s.surname.toUpperCase()}, ${s.firstName}${s.otherNames ? " " + s.otherNames : ""}`],
    ["Matric No.", s.matricNo],
    ["Programme", s.programme.name],
    ["Department", s.programme.department.name],
  ];
  kv.forEach(([k, v], i) => {
    text(page, k, M, y - i * 14, font, 8.5, C.muted);
    text(page, v, M + 70, y - i * 14, bold, 9);
  });
  page.drawImage(qr, { x: W - M - 74, y: y - 60, width: 74, height: 74 });
  y -= 4 * 14 + 22;

  const cols = [
    { h: "S/N", x: M, w: 24 },
    { h: "Code", x: M + 26, w: 58 },
    { h: "Course Title", x: M + 86, w: 200 },
    { h: "Units", x: M + 300, w: 30 },
    { h: "Score", x: M + 336, w: 34 },
    { h: "Grade", x: M + 376, w: 34 },
    { h: "GP", x: M + 414, w: 24 },
    { h: "QP", x: M + 442, w: 26 },
    { h: "Status", x: M + 472, w: 70 },
  ];

  for (const sem of semesters) {
    if (y < 200) {
      page = pdf.addPage([W, H]);
      y = H - M;
      header();
    }
    text(page, sem.label, M, y, bold, 10, C.navy);
    y -= 16;
    page.drawRectangle({ x: M, y: y - 4, width: W - 2 * M, height: 16, color: C.band });
    cols.forEach((c) => text(page, c.h, c.x + 2, y, bold, 8));
    y -= 18;
    const lines = sem.lines.filter((l) => l.status !== "Pending");
    lines.forEach((l, i) => {
      if (y < 90) {
        page = pdf.addPage([W, H]);
        y = H - M;
        header();
      }
      const title = l.title.length > 42 ? l.title.slice(0, 41) + "…" : l.title;
      const cells = [String(i + 1), l.courseCode, title, String(l.units), l.score == null ? "—" : String(l.score), l.grade ?? "—", l.gradePoint == null ? "—" : String(l.gradePoint), l.qualityPoints == null ? "—" : String(l.qualityPoints), l.status];
      cells.forEach((v, j) => text(page, v, cols[j]!.x + 2, y, font, 8.5));
      y -= 14;
    });
    const sm = sem.summary!;
    y -= 4;
    page.drawLine({ start: { x: M, y: y + 8 }, end: { x: W - M, y: y + 8 }, thickness: 0.5, color: C.rule });
    const summary = [
      `Semester: ${sm.semester.units} units · ${sm.semester.qualityPoints} QP · GPA ${formatGpa(sm.semester.gpa)}`,
      `Cumulative: ${sm.cumulative.units} units · ${sm.cumulative.qualityPoints} QP · CGPA ${formatGpa(sm.cumulative.gpa)}`,
    ];
    summary.forEach((t) => {
      text(page, t, M, y - 4, bold, 8.5);
      y -= 13;
    });
    if (sem.hasPending) {
      text(page, "Some courses this semester are not yet published and are not included.", M, y - 4, font, 8, C.muted);
      y -= 13;
    }
    y -= 14;
  }

  // Footer on the last page
  const last = semesters.at(-1)!.summary!;
  page.drawLine({ start: { x: M, y: 92 }, end: { x: W - M, y: 92 }, thickness: 0.8, color: C.rule });
  text(page, `CGPA ${formatGpa(last.cumulative.gpa)} · Standing: ${last.standing ?? "—"} · Class (to date): ${last.degreeClass ?? "—"}`, M, 78, bold, 9);
  text(page, `Grades: ${rec.policy.bands.map((b) => `${b.grade} ${b.min}+ (${b.point})`).join(" · ")}`, M, 64, font, 7.5, C.muted);
  text(page, `Verify: ${verifyUrl}`, M, 52, font, 7.5, C.muted);
  text(page, `Issued ${statement.issuedAt.toISOString().slice(0, 10)} · Ref ${statement.code}`, M, 40, font, 7.5, C.muted);
  const notice = brand.official
    ? "Official published statement. Valid only if the verification page shows status VALID."
    : "PILOT — not an official university document. Valid only if the verification page shows status VALID.";
  text(page, notice, M, 28, bold, 7.5, brand.official ? C.navy : rgb(0.75, 0.22, 0.17));

  return pdf.save();
}
