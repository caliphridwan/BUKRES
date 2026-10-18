import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { can } from "@/lib/authz";
import { db } from "@/lib/db";
import { templateCsv } from "@/lib/import/parse";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";

/** CSV template pre-filled with the class list of one offering. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await getSessionUser();
  const { id } = await params;
  if (!me || me.role === "STUDENT") return new NextResponse("Not found", { status: 404 });
  const o = await db.courseOffering.findUnique({
    where: { id },
    include: { course: true, semester: { include: { session: true } }, assignments: true, registrations: { include: { student: true } } },
  });
  if (!o || !can(me, { type: "offering.view", offering: { departmentId: o.course.departmentId, assignedStaffIds: o.assignments.map((a) => a.staffId) } })) {
    return new NextResponse("Not found", { status: 404 });
  }
  const matrics = o.registrations.map((r) => r.student.matricNo).sort();
  const csv = templateCsv(o.course.code, o.semester.session.name, o.semester.number, matrics);
  await audit({ actorId: me.userId, action: "export.classList", entity: "CourseOffering", entityId: id });
  return new NextResponse("﻿" + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${o.course.code.replace(/\s+/g, "")}-${o.semester.session.name.replace("/", "-")}-S${o.semester.number}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
