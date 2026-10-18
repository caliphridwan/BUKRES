import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { renderStatementPdf } from "@/lib/services/statements";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";

/**
 * GET /student/statement[?semester=<id>]
 * The student is resolved from the session; `semester` can only narrow the
 * student's OWN record (the snapshot lookup is filtered by studentId), so
 * another student's id simply yields 404.
 */
export async function GET(req: Request) {
  const me = await getSessionUser();
  if (!me || me.role !== "STUDENT" || !me.studentId) return new NextResponse("Not found", { status: 404 });
  const semester = new URL(req.url).searchParams.get("semester");
  if (semester && !/^[a-z0-9]{20,40}$/.test(semester)) return new NextResponse("Not found", { status: 404 });

  const pdf = await renderStatementPdf(me.studentId, semester);
  if (!pdf) return new NextResponse("No published results for that selection.", { status: 404 });

  await audit({ actorId: me.userId, action: "statement.download", entity: "StudentProfile", entityId: me.studentId, after: { semester } });
  return new NextResponse(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="result-statement-${me.username.replace(/[^A-Z0-9]/gi, "-")}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
