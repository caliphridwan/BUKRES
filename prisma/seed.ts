/**
 * Development seed — SYNTHETIC DATA ONLY.
 * Creates the faculty structure, a default (unconfirmed) grade scale, demo
 * staff and students with obviously fake matric numbers, and results in
 * every workflow state so each screen has something to show.
 *
 *   npm run db:seed
 */
import { PrismaClient, type Prisma } from "@prisma/client";
import { hash } from "@node-rs/argon2";
import { DEFAULT_POLICY, gradeScore } from "../lib/grading/engine";
import { recomputeStudents } from "../lib/services/snapshots";

if (process.env.NODE_ENV === "production") {
  console.error("Refusing to seed demo data in production.");
  process.exit(1);
}

const db = new PrismaClient();
const DEMO_PASSWORD = "Demo-Password-2026";

// Deterministic pseudo-random so every seed run produces the same scores.
let s = 20261018;
const rand = () => ((s = (s * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
const between = (lo: number, hi: number) => Math.round(lo + rand() * (hi - lo));

const FIRST = ["Aisha", "Musa", "Fatima", "Ibrahim", "Zainab", "Usman", "Hauwa", "Abubakar", "Maryam", "Sani", "Khadija", "Yusuf", "Amina", "Bello", "Hafsat", "Kabir", "Ruqayya", "Nasir", "Safiya", "Tijjani"];
const LAST = ["Abdullahi", "Garba", "Sule", "Bala", "Danjuma", "Lawal", "Haruna", "Idris", "Kabiru", "Mohammed", "Aliyu", "Yakubu", "Ismail", "Shehu", "Umar", "Adamu", "Tanko", "Sambo", "Dahiru", "Jibril"];

async function main() {
  console.log("Clearing existing data…");
  const tables = ["Statement", "GpaSnapshot", "ApprovalAction", "ImportBatch", "Result", "ResultSubmission", "CourseRegistration", "CourseAssignment", "CourseOffering", "Course", "Semester", "AcademicSession", "Notification", "AuditLog", "LoginAttempt", "Session", "StudentProfile", "StaffProfile", "User", "Programme", "Department", "GradeScale", "Setting"];
  await db.$executeRawUnsafe(`TRUNCATE ${tables.map((t) => `"${t}"`).join(", ")} CASCADE`);

  const pw = await hash(DEMO_PASSWORD, { memoryCost: 19456, timeCost: 2, parallelism: 1 });

  // ── Structure (department names from fci.buk.edu.ng; codes are placeholders)
  const depts = await Promise.all(
    [
      { code: "CSC", name: "Computer Science", hodEmail: "hod.cs@buk.edu.ng" },
      { code: "IFT", name: "Information Technology", hodEmail: "hod.it@buk.edu.ng" },
      { code: "SWE", name: "Software Engineering", hodEmail: "hod.se@buk.edu.ng" },
    ].map((d) => db.department.create({ data: d })),
  );
  const [cs, it, se] = depts as [typeof depts[0], typeof depts[0], typeof depts[0]];
  const progs = {
    csc: await db.programme.create({ data: { code: "BSC-CSC", name: "B.Sc. Computer Science", departmentId: cs.id } }),
    ift: await db.programme.create({ data: { code: "BSC-IFT", name: "B.Sc. Information Technology", departmentId: it.id } }),
    cys: await db.programme.create({ data: { code: "BSC-CYS", name: "B.Sc. Cyber Security", departmentId: it.id } }),
    swe: await db.programme.create({ data: { code: "BSC-SWE", name: "B.Sc. Software Engineering", departmentId: se.id } }),
  };

  const scale = await db.gradeScale.create({
    data: {
      name: "NUC-5PT-DEFAULT",
      version: 1,
      bands: DEFAULT_POLICY.bands as unknown as Prisma.InputJsonValue,
      classes: DEFAULT_POLICY.classes as unknown as Prisma.InputJsonValue,
      standing: DEFAULT_POLICY.standing as unknown as Prisma.InputJsonValue,
      decimals: 2,
      rounding: "HALF_UP",
      repeatPolicy: "ALL_ATTEMPTS_COUNT",
      confirmed: false,
      isActive: true,
    },
  });

  const s2425 = await db.academicSession.create({ data: { name: "2024/2025", startYear: 2024 } });
  const s2526 = await db.academicSession.create({ data: { name: "2025/2026", startYear: 2025, isCurrent: true } });
  const sem = {
    a1: await db.semester.create({ data: { sessionId: s2425.id, number: 1 } }),
    a2: await db.semester.create({ data: { sessionId: s2425.id, number: 2 } }),
    b1: await db.semester.create({ data: { sessionId: s2526.id, number: 1 } }),
  };

  // ── Courses (illustrative codes and titles — replace with the real catalogue)
  type C = { code: string; title: string; units: number; level: number; semester: number; dept: string; caMax?: number; examMax?: number };
  const catalogue: C[] = [
    { code: "CSC 1201", title: "Introduction to Computer Science", units: 3, level: 100, semester: 1, dept: cs.id },
    { code: "CSC 1203", title: "Introduction to Programming", units: 3, level: 100, semester: 1, dept: cs.id },
    { code: "MTH 1201", title: "Elementary Mathematics I", units: 3, level: 100, semester: 1, dept: cs.id },
    { code: "GST 1201", title: "Use of English", units: 2, level: 100, semester: 1, dept: cs.id },
    { code: "CSC 1202", title: "Problem Solving with Python", units: 3, level: 100, semester: 2, dept: cs.id },
    { code: "CSC 1204", title: "Discrete Structures", units: 3, level: 100, semester: 2, dept: cs.id },
    { code: "IFT 1202", title: "Foundations of Information Technology", units: 2, level: 100, semester: 2, dept: it.id },
    { code: "SWE 1202", title: "Software Development Fundamentals", units: 2, level: 100, semester: 2, dept: se.id },
    { code: "CSC 2201", title: "Data Structures and Algorithms", units: 3, level: 200, semester: 1, dept: cs.id },
    { code: "CSC 2203", title: "Computer Architecture", units: 3, level: 200, semester: 1, dept: cs.id },
    { code: "IFT 2201", title: "Database Systems I", units: 3, level: 200, semester: 1, dept: it.id },
    { code: "SWE 2201", title: "Object-Oriented Design", units: 2, level: 200, semester: 1, dept: se.id },
    { code: "CSC 2205", title: "Mini Project", units: 2, level: 200, semester: 1, dept: cs.id, caMax: 100, examMax: 0 },
  ];
  const courses = new Map<string, Awaited<ReturnType<typeof db.course.create>>>();
  for (const c of catalogue) {
    courses.set(c.code, await db.course.create({ data: { code: c.code, title: c.title, units: c.units, level: c.level, semester: c.semester, departmentId: c.dept, caMax: c.caMax ?? 40, examMax: c.examMax ?? 60 } }));
  }

  // ── Staff
  async function staff(username: string, role: Prisma.UserCreateInput["role"], first: string, last: string, title: string, departmentId: string | null) {
    return db.user.create({
      data: { username, role, status: "ACTIVE", passwordHash: pw, staff: { create: { staffNo: username, firstName: first, surname: last, title, departmentId } } },
      include: { staff: true },
    });
  }
  const admin = await staff("ADMIN01", "FACULTY_ADMIN", "Faculty", "Administrator", "Mal.", null);
  await staff("SUPER01", "SUPER_ADMIN", "System", "Administrator", "", null);
  await staff("HODCSC", "HOD", "Demo", "Head (CS)", "Dr.", cs.id);
  await staff("DROCSC", "DEPT_RESULT_OFFICER", "Demo", "Result Officer (CS)", "Mal.", cs.id);
  await staff("HODIFT", "HOD", "Demo", "Head (IT)", "Dr.", it.id);
  await staff("HODSWE", "HOD", "Demo", "Head (SE)", "Dr.", se.id);
  await staff("DROIFT", "DEPT_RESULT_OFFICER", "Demo", "Result Officer (IT)", "Mal.", it.id);
  await staff("DROSWE", "DEPT_RESULT_OFFICER", "Demo", "Result Officer (SE)", "Mal.", se.id);
  const lec1 = await staff("LEC001", "LECTURER", "Demo", "Lecturer One", "Dr.", cs.id);
  const lec2 = await staff("LEC002", "LECTURER", "Demo", "Lecturer Two", "Mal.", it.id);

  // ── Students: 24 synthetic 200-level students across programmes
  const programmeList = [progs.csc, progs.csc, progs.ift, progs.cys, progs.swe];
  const students = [];
  for (let i = 0; i < 24; i++) {
    const matricNo = `DEMO/24/${String(i + 1).padStart(4, "0")}`;
    const u = await db.user.create({
      data: {
        username: matricNo,
        role: "STUDENT",
        status: i === 23 ? "PENDING_ACTIVATION" : "ACTIVE",
        passwordHash: i === 23 ? null : pw,
        email: i === 23 ? null : `student${i + 1}@example.edu.ng`,
        student: { create: { matricNo, firstName: FIRST[i % 20]!, surname: LAST[(i * 7) % 20]!, programmeId: programmeList[i % 5]!.id, entryYear: 2024, currentLevel: 200 } },
      },
      include: { student: true },
    });
    students.push(u.student!);
  }

  // ── Offerings, registrations, results
  const ability = new Map(students.map((st) => [st.id, between(-12, 14)]));

  async function offer(code: string, semesterId: string, stage: "PUBLISHED" | "SUBMITTED" | "DRAFT", lecturerStaffId: string, opts: { fill?: boolean } = {}) {
    const course = courses.get(code)!;
    const o = await db.courseOffering.create({ data: { courseId: course.id, semesterId } });
    await db.courseAssignment.create({ data: { offeringId: o.id, staffId: lecturerStaffId } });
    const sub = await db.resultSubmission.create({ data: { offeringId: o.id, stage } });
    const now = new Date();
    for (const st of students) {
      const reg = await db.courseRegistration.create({ data: { studentId: st.id, offeringId: o.id } });
      if (opts.fill === false) continue;
      const absent = rand() < 0.02;
      const base = 58 + ability.get(st.id)! + between(-14, 14);
      const total = Math.max(18, Math.min(96, base));
      const ca = course.caMax === 0 ? 0 : Math.min(course.caMax, Math.round((total * course.caMax) / 100 + between(-3, 3)));
      const exam = Math.min(course.examMax, Math.max(0, total - ca));
      const g = gradeScore(ca + exam);
      await db.result.create({
        data: {
          registrationId: reg.id,
          caScore: ca,
          examScore: absent ? null : exam,
          totalScore: absent ? null : ca + exam,
          grade: absent ? null : g.grade,
          gradePoint: absent ? null : g.point,
          outcome: absent ? "ABSENT" : "GRADED",
          units: course.units,
          gradeScaleId: scale.id,
          status: stage === "PUBLISHED" ? "PUBLISHED" : stage === "SUBMITTED" ? "IN_REVIEW" : "DRAFT",
          publishedAt: stage === "PUBLISHED" ? now : null,
        },
      });
    }
    if (stage !== "DRAFT") {
      await db.approvalAction.create({ data: { submissionId: sub.id, verb: "SUBMIT", fromStage: "DRAFT", toStage: "SUBMITTED", actorId: lec1.id } });
    }
    if (stage === "PUBLISHED") {
      await db.approvalAction.create({ data: { submissionId: sub.id, verb: "PUBLISH", fromStage: "SENATE_RATIFIED", toStage: "PUBLISHED", actorId: admin.id, reason: "Seeded as already ratified" } });
    }
    return o;
  }

  const L1 = lec1.staff!.id, L2 = lec2.staff!.id;
  for (const c of ["CSC 1201", "CSC 1203", "MTH 1201", "GST 1201"]) await offer(c, sem.a1.id, "PUBLISHED", L1);
  for (const c of ["CSC 1202", "CSC 1204", "IFT 1202", "SWE 1202"]) await offer(c, sem.a2.id, "PUBLISHED", c.startsWith("IFT") ? L2 : L1);
  await offer("CSC 2201", sem.b1.id, "PUBLISHED", L1);
  await offer("CSC 2203", sem.b1.id, "SUBMITTED", L1);
  await offer("IFT 2201", sem.b1.id, "DRAFT", L2);
  await offer("SWE 2201", sem.b1.id, "DRAFT", L1, { fill: false });
  await offer("CSC 2205", sem.b1.id, "DRAFT", L1, { fill: false });

  console.log("Calculating GPA snapshots…");
  await db.$transaction(async (tx) => recomputeStudents(tx, students.map((st) => st.id)), { timeout: 120_000 });

  console.log("\nSeed complete. Demo accounts (password for all: %s):", DEMO_PASSWORD);
  console.table([
    { role: "Student", username: "DEMO/24/0001" },
    { role: "Student (not activated)", username: "DEMO/24/0024 — issue a code from Admin → Students" },
    { role: "Lecturer (CS)", username: "LEC001" },
    { role: "Lecturer (IT)", username: "LEC002" },
    { role: "Dept. Result Officers", username: "DROCSC / DROIFT / DROSWE" },
    { role: "HODs", username: "HODCSC / HODIFT / HODSWE" },
    { role: "Faculty Admin", username: "ADMIN01" },
    { role: "Super Admin", username: "SUPER01" },
  ]);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
