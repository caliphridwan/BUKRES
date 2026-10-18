import { formatGpa } from "@/lib/grading/engine";
import type { SemesterView } from "@/lib/services/student";
import { Badge, statusTone } from "./ui";

export function ResultTable({ sem, showScores }: { sem: SemesterView; showScores: boolean }) {
  const sum = sem.summary;
  return (
    <section className="card overflow-hidden" aria-labelledby={`sem-${sem.semesterId}`}>
      <div className="flex flex-col gap-2 border-b border-line px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <h2 id={`sem-${sem.semesterId}`} className="font-semibold">{sem.label}</h2>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
          {sem.publishedAt ? <span>Published {sem.publishedAt.toLocaleDateString("en-NG", { dateStyle: "medium" })}</span> : null}
          {sem.hasPending ? <Badge tone="warn">Some results pending</Badge> : <Badge tone="good">Complete</Badge>}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <caption className="sr-only">Course results for {sem.label}</caption>
          <thead className="bg-canvas text-left text-xs uppercase tracking-wide text-muted">
            <tr>
              <th scope="col" className="px-4 py-2.5 font-semibold">S/N</th>
              <th scope="col" className="px-2 py-2.5 font-semibold">Code</th>
              <th scope="col" className="px-2 py-2.5 font-semibold">Course title</th>
              <th scope="col" className="table-num px-2 py-2.5 font-semibold">Units</th>
              {showScores ? <th scope="col" className="table-num px-2 py-2.5 font-semibold">Score</th> : null}
              <th scope="col" className="px-2 py-2.5 text-center font-semibold">Grade</th>
              <th scope="col" className="table-num px-2 py-2.5 font-semibold">GP</th>
              <th scope="col" className="table-num px-2 py-2.5 font-semibold">QP</th>
              <th scope="col" className="px-4 py-2.5 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody>
            {sem.lines.map((l, i) => (
              <tr key={l.courseCode} className="border-t border-line">
                <td className="px-4 py-2.5 text-muted tabular-nums">{i + 1}</td>
                <td className="whitespace-nowrap px-2 py-2.5 font-mono text-[13px] font-medium">{l.courseCode}</td>
                <td className="px-2 py-2.5">
                  {l.title}
                  {l.note ? <span className="ml-2 text-xs text-muted">({l.note})</span> : null}
                </td>
                <td className="table-num px-2 py-2.5">{l.units}</td>
                {showScores ? <td className="table-num px-2 py-2.5">{l.score ?? "—"}</td> : null}
                <td className="px-2 py-2.5 text-center font-semibold">{l.grade ?? "—"}</td>
                <td className="table-num px-2 py-2.5">{l.gradePoint ?? "—"}</td>
                <td className="table-num px-2 py-2.5">{l.qualityPoints ?? "—"}</td>
                <td className="px-4 py-2.5"><Badge tone={statusTone(l.status)}>{l.status}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {sum ? (
        <dl className="grid grid-cols-2 gap-px border-t border-line bg-line text-sm sm:grid-cols-4">
          {[
            ["Units counted", String(sum.semester.units)],
            ["Quality points", String(sum.semester.qualityPoints)],
            ["Semester GPA", formatGpa(sum.semester.gpa)],
            ["Previous cumulative", sem.previous ? `${sem.previous.units} units · ${sem.previous.qualityPoints} QP` : "—"],
            ["Cumulative units", String(sum.cumulative.units)],
            ["Cumulative QP", String(sum.cumulative.qualityPoints)],
            ["CGPA", formatGpa(sum.cumulative.gpa)],
            ["Standing", sum.standing ?? "—"],
          ].map(([k, v]) => (
            <div key={k} className="bg-white px-4 py-3">
              <dt className="text-xs text-muted">{k}</dt>
              <dd className={`mt-0.5 font-semibold tabular-nums ${k === "CGPA" || k === "Semester GPA" ? "text-navy" : ""}`}>{v}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="border-t border-line px-5 py-4 text-sm text-muted">No results for this semester have been published yet.</p>
      )}
      {sum?.excluded.length ? (
        <p className="border-t border-line px-5 py-3 text-xs text-muted">
          Not counted in GPA: {sum.excluded.map((e) => `${e.courseCode} (${e.reason.toLowerCase().replace(/_/g, " ")})`).join(", ")}. Missing or withheld results are never counted as zero.
        </p>
      ) : null}
    </section>
  );
}

export function GradeLegend({ bands }: { bands: Array<{ min: number; max: number; grade: string; point: number }> }) {
  return (
    <div className="card p-4 text-sm">
      <h3 className="eyebrow">Grading scale</h3>
      <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-1">
        {[...bands].sort((a, b) => b.min - a.min).map((b) => (
          <li key={b.grade}><span className="font-semibold">{b.grade}</span> <span className="text-muted">{b.min}–{Math.floor(b.max)} · {b.point} pt</span></li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-muted">QP = units × grade point. GPA = total QP ÷ total units. CGPA uses all counted units to date — it is not an average of semester GPAs.</p>
    </div>
  );
}
