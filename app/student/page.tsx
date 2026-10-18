import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { getStudentRecord } from "@/lib/services/student";
import { formatGpa } from "@/lib/grading/engine";
import { GpaChart } from "@/components/gpa-chart";
import { Badge, EmptyState, StatCard } from "@/components/ui";

export const metadata = { title: "Dashboard" };

const TREND = { up: { t: "▲ Up from last semester", c: "text-good" }, down: { t: "▼ Down from last semester", c: "text-bad" }, flat: { t: "Same as last semester", c: "text-muted" } };

export default async function StudentDashboard() {
  const me = await requireUser(["STUDENT"]);
  const rec = await getStudentRecord(me.studentId!); // id from the session, never the URL
  const s = rec.student;
  const latest = rec.latest;
  const sum = latest?.summary ?? null;
  const pendingSemesters = rec.semesters.filter((x) => x.hasPending);

  return (
    <div className="space-y-6">
      <section className="card overflow-hidden">
        <div className="flex flex-col gap-4 bg-navy p-5 text-white sm:flex-row sm:items-end sm:justify-between sm:p-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-gold">Welcome back</p>
            <h1 className="mt-1 text-2xl font-semibold">{s.firstName} {s.surname}</h1>
            <p className="mt-1 font-mono text-sm text-white/75">{s.matricNo}</p>
          </div>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
            {[["Department", s.programme.department.name], ["Programme", s.programme.name], ["Level", `${s.currentLevel} Level`], ["Session", rec.currentSession ?? "—"]].map(([k, v]) => (
              <div key={k}><dt className="text-xs text-white/60">{k}</dt><dd className="font-medium">{v}</dd></div>
            ))}
          </dl>
        </div>
      </section>

      {pendingSemesters.length ? (
        <p className="rounded-lg border border-line bg-white px-4 py-3 text-sm text-muted">
          Some results for {pendingSemesters.map((p) => p.label).join(", ")} are still going through approval. They will appear here once published.
        </p>
      ) : null}

      {!sum ? (
        <EmptyState title="No published results yet">
          Your results appear here as soon as the Faculty publishes them. You will get a notification.
        </EmptyState>
      ) : (
        <>
          <section aria-label="Academic overview" className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            <StatCard label="Latest GPA" value={formatGpa(sum.semester.gpa)} hint={rec.trend ? <span className={TREND[rec.trend].c}>{TREND[rec.trend].t}</span> : latest!.label} />
            <StatCard accent label="CGPA" value={formatGpa(sum.cumulative.gpa)} hint={sum.degreeClass ?? undefined} />
            <StatCard label="Units earned" value={`${sum.unitsEarned}`} hint={`of ${sum.cumulative.units} counted`} />
            <StatCard label="Published semesters" value={rec.published.length} hint={sum.standing ?? undefined} />
          </section>

          <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
            <section className="card p-5 sm:p-6">
              <h2 className="font-semibold">Academic performance</h2>
              <div className="mt-4">
                <GpaChart
                  points={rec.published.map((p) => ({
                    label: p.label,
                    short: `${p.sessionName.slice(2, 4)}/${p.sessionName.slice(7, 9)} S${p.semesterNumber}`,
                    gpa: p.summary!.semester.gpa,
                    cgpa: p.summary!.cumulative.gpa,
                  }))}
                />
              </div>
            </section>

            <div className="space-y-6">
              <section className="card p-5 sm:p-6">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-semibold">Most recent result</h2>
                    <p className="mt-0.5 text-sm text-muted">{latest!.label}</p>
                  </div>
                  <Badge tone="good">Published</Badge>
                </div>
                <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-lg bg-canvas p-3"><dt className="text-xs text-muted">GPA</dt><dd className="text-lg font-semibold tabular-nums">{formatGpa(sum.semester.gpa)}</dd></div>
                  <div className="rounded-lg bg-canvas p-3"><dt className="text-xs text-muted">CGPA</dt><dd className="text-lg font-semibold tabular-nums">{formatGpa(sum.cumulative.gpa)}</dd></div>
                </dl>
                {latest!.publishedAt ? <p className="mt-3 text-xs text-muted">Published {latest!.publishedAt.toLocaleDateString("en-NG", { dateStyle: "long" })}</p> : null}
                <Link href={`/student/results?semester=${latest!.semesterId}`} className="btn-primary mt-4 w-full">View full result</Link>
              </section>

              {sum.outstanding.length ? (
                <section className="card p-5 sm:p-6">
                  <h2 className="font-semibold">Outstanding courses</h2>
                  <p className="mt-0.5 text-sm text-muted">Failed and not yet passed — register these as carryovers.</p>
                  <ul className="mt-3 flex flex-wrap gap-2">{sum.outstanding.map((c) => <li key={c}><Badge tone="bad">{c}</Badge></li>)}</ul>
                </section>
              ) : null}
            </div>
          </div>
        </>
      )}

      <section aria-label="Quick actions" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["/student/results", "View all results"],
          ["/student/statement", "Download statement"],
          ["/student/history", "Academic history"],
          ["/student/account", "Account security"],
        ].map(([href, label]) => (
          // Plain anchors: one of these is a PDF download, not a page.
          <a key={href} href={href} className="card flex items-center justify-between px-4 py-3.5 text-sm font-medium hover:border-royal/40">
            {label}<span aria-hidden className="text-royal">→</span>
          </a>
        ))}
      </section>
    </div>
  );
}
