import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { getStudentRecord } from "@/lib/services/student";
import { formatGpa } from "@/lib/grading/engine";
import { EmptyState, PageHeader } from "@/components/ui";

export const metadata = { title: "Academic history" };

export default async function HistoryPage() {
  const me = await requireUser(["STUDENT"]);
  const rec = await getStudentRecord(me.studentId!);
  const rows = rec.published;
  const last = rows.at(-1)?.summary;

  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Academic history" title="All published semesters">
        {rows.length ? <a className="btn-primary" href="/student/statement">Cumulative statement (PDF)</a> : null}
      </PageHeader>
      {rows.length === 0 ? (
        <EmptyState title="Nothing published yet" />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <caption className="sr-only">Semester-by-semester GPA and CGPA</caption>
            <thead className="bg-canvas text-left text-xs uppercase tracking-wide text-muted">
              <tr>
                <th scope="col" className="px-4 py-2.5">Semester</th>
                <th scope="col" className="table-num px-3 py-2.5">Units</th>
                <th scope="col" className="table-num px-3 py-2.5">QP</th>
                <th scope="col" className="table-num px-3 py-2.5">GPA</th>
                <th scope="col" className="table-num px-3 py-2.5">Cum. units</th>
                <th scope="col" className="table-num px-3 py-2.5">CGPA</th>
                <th scope="col" className="px-4 py-2.5"><span className="sr-only">Open</span></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.semesterId} className="border-t border-line">
                  <td className="px-4 py-3 font-medium">{s.label}</td>
                  <td className="table-num px-3">{s.summary!.semester.units}</td>
                  <td className="table-num px-3">{s.summary!.semester.qualityPoints}</td>
                  <td className="table-num px-3 font-semibold">{formatGpa(s.summary!.semester.gpa)}</td>
                  <td className="table-num px-3">{s.summary!.cumulative.units}</td>
                  <td className="table-num px-3 font-semibold text-navy">{formatGpa(s.summary!.cumulative.gpa)}</td>
                  <td className="px-4 text-right"><Link className="text-sm font-medium text-royal" href={`/student/results?semester=${s.semesterId}`}>View</Link></td>
                </tr>
              ))}
            </tbody>
            {last ? (
              <tfoot className="border-t-2 border-line bg-canvas">
                <tr>
                  <td className="px-4 py-3 font-semibold" colSpan={4}>Class of degree to date: {last.degreeClass ?? "—"} · {last.standing ?? ""}</td>
                  <td className="table-num px-3 font-semibold">{last.cumulative.units}</td>
                  <td className="table-num px-3 font-semibold text-navy">{formatGpa(last.cumulative.gpa)}</td>
                  <td />
                </tr>
              </tfoot>
            ) : null}
          </table>
        </div>
      )}
    </div>
  );
}
