import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { ForbiddenError } from "@/lib/authz";
import { getOfferingDetail } from "@/lib/services/results";
import { Alert, Badge, PageHeader, StatCard } from "@/components/ui";
import { STAGE_LABEL, nextStage } from "@/lib/workflow";
import { ScoreGrid, UploadPanel, WorkflowPanel } from "./client";

export const metadata = { title: "Course results" };

export default async function CourseDetail({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireUser();
  const { id } = await params;
  let d: Awaited<ReturnType<typeof getOfferingDetail>>;
  try {
    d = await getOfferingDetail(me, id);
  } catch (e) {
    if (e instanceof ForbiddenError) notFound(); // same response as "does not exist"
    throw e;
  }
  const next = nextStage(d.stage, d.stages);
  const forwardLabel = d.stage === "DRAFT" ? "Submit for review" : next === "PUBLISHED" ? "Publish to students" : `Approve → ${STAGE_LABEL[next!]}`;
  const maxCount = Math.max(1, ...d.stats.distribution.map((x) => x.count));

  return (
    <div className="space-y-6">
      <PageHeader eyebrow={`${d.offering.department} · ${d.offering.sessionName} · ${d.offering.semesterNumber === 1 ? "First" : "Second"} semester`} title={`${d.offering.code} — ${d.offering.title}`}>
        <Badge tone={d.stage === "PUBLISHED" ? "good" : d.stage === "DRAFT" ? "neutral" : "warn"}>{d.stageLabel}</Badge>
        {d.isCorrection ? <Badge tone="bad">Correction in progress</Badge> : null}
      </PageHeader>

      {/* Stage tracker */}
      <ol aria-label="Approval progress" className="flex flex-wrap gap-x-1 gap-y-2 text-xs">
        {d.stages.map((s, i) => {
          const idx = d.stages.indexOf(d.stage);
          const state = i < idx ? "done" : i === idx ? "now" : "todo";
          return (
            <li key={s} aria-current={state === "now" ? "step" : undefined} className={`rounded-full px-3 py-1 font-medium ${state === "done" ? "bg-good/10 text-good" : state === "now" ? "bg-navy text-white" : "bg-white text-muted ring-1 ring-line"}`}>
              {s === "DRAFT" ? "Draft" : s === "SUBMITTED" ? "Submitted" : s === "DEPARTMENTAL_REVIEW" ? "Dept. reviewed" : s === "HOD_APPROVAL" ? "HOD approved" : s === "FACULTY_BOARD" ? "Faculty Board" : s === "SENATE_RATIFIED" ? "Senate ratified" : "Published"}
            </li>
          );
        })}
      </ol>

      <section className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Registered" value={d.stats.total} hint={`${d.offering.units} units`} />
        <StatCard label="Scores entered" value={`${d.stats.entered}/${d.stats.total}`} hint={d.stats.missing ? `${d.stats.missing} missing` : "Complete"} />
        <StatCard label="Pass rate" value={d.stats.passRate == null ? "—" : `${d.stats.passRate}%`} />
        <StatCard label="Mean score" value={d.stats.mean ?? "—"} />
      </section>

      {d.stats.missing && d.stage === "DRAFT" && d.canEdit ? (
        <Alert tone="warn">{d.stats.missing} registered student(s) have no score. Every student needs a score or ABS before you can submit.</Alert>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6 min-w-0">
          <ScoreGrid offeringId={d.offering.id} rows={d.rows} caMax={d.offering.caMax} examMax={d.offering.examMax} editable={d.canEdit} />
        </div>
        <aside className="space-y-6">
          <WorkflowPanel offeringId={d.offering.id} canForward={d.canForward} canReturn={d.canReturn} canCorrect={d.canRequestCorrection} forwardLabel={forwardLabel} />
          {d.canEdit ? <UploadPanel offeringId={d.offering.id} /> : null}

          <section className="card p-5">
            <h2 className="font-semibold">Grade distribution</h2>
            <ul className="mt-3 space-y-1.5" aria-label="Number of students per grade">
              {d.stats.distribution.map((g) => (
                <li key={g.grade} className="flex items-center gap-2 text-sm">
                  <span className="w-4 font-semibold">{g.grade}</span>
                  <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-canvas">
                    <span className={`block h-full rounded-full ${g.grade === "F" ? "bg-bad" : "bg-royal"}`} style={{ width: `${(g.count / maxCount) * 100}%` }} />
                  </span>
                  <span className="w-8 text-right tabular-nums text-muted">{g.count}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="card p-5">
            <h2 className="font-semibold">History</h2>
            {d.history.length === 0 ? <p className="mt-2 text-sm text-muted">No actions yet.</p> : (
              <ol className="mt-3 space-y-3 text-sm">
                {d.history.map((h, i) => (
                  <li key={i} className="border-l-2 border-line pl-3">
                    <div className="font-medium">{h.verb.replace(/_/g, " ").toLowerCase()} · {h.to}</div>
                    <div className="text-xs text-muted">{h.by} · {h.at.toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" })}</div>
                    {h.reason ? <div className="mt-1 text-xs">“{h.reason}”</div> : null}
                  </li>
                ))}
              </ol>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
