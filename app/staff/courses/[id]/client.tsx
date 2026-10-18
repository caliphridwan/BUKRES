"use client";

import { useActionState, useMemo, useState } from "react";
import { SubmitButton } from "@/components/forms";
import { commitUpload, moveSubmission, previewUpload, saveGrid, startCorrection, type FlowState, type GridState, type UploadState } from "./actions";

// Display-only grade preview. The server re-grades with the active policy;
// this copy only helps lecturers spot typos while typing.
const PREVIEW_BANDS: Array<[number, string]> = [[70, "A"], [60, "B"], [50, "C"], [45, "D"], [40, "E"], [0, "F"]];
const previewGrade = (t: number) => PREVIEW_BANDS.find(([m]) => t >= m)?.[1] ?? "—";

export interface GridRow { registrationId: string; matricNo: string; name: string; ca: number | null; exam: number | null; grade: string | null; outcome: string | null; publishedTotal: number | null }

export function ScoreGrid({ offeringId, rows, caMax, examMax, editable }: { offeringId: string; rows: GridRow[]; caMax: number; examMax: number; editable: boolean }) {
  const [state, action] = useActionState<GridState, FormData>(saveGrid.bind(null, offeringId), undefined);
  const [values, setValues] = useState(() => rows.map((r) => ({ ca: r.ca?.toString() ?? "", exam: r.outcome === "ABSENT" ? "ABS" : r.exam?.toString() ?? "" })));
  const [filter, setFilter] = useState("");
  const rejectedBy = useMemo(() => new Map((state?.rejected ?? []).map((r) => [r.matricNo, r.errors.join("; ")])), [state]);

  const set = (i: number, k: "ca" | "exam", v: string) => setValues((vs) => vs.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
  const visible = rows.map((r, i) => ({ r, i })).filter(({ r }) => !filter || `${r.matricNo} ${r.name}`.toLowerCase().includes(filter.toLowerCase()));

  return (
    <form action={action} className="card overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-line px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-semibold">Score sheet</h2>
          <p className="text-xs text-muted">CA out of {caMax}, exam out of {examMax}. Type ABS in the exam column for an absent student. Blank rows are left unchanged.</p>
        </div>
        <input aria-label="Filter students" placeholder="Filter by name or matric" className="input sm:w-64" value={filter} onChange={(e) => setFilter(e.target.value)} />
      </div>
      <div className="max-h-[60vh] overflow-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="sticky top-0 z-10 bg-canvas text-left text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-2.5">Matric no.</th><th className="px-2 py-2.5">Name</th>
              <th className="px-2 py-2.5 text-right">CA</th><th className="px-2 py-2.5 text-right">Exam</th>
              <th className="px-2 py-2.5 text-right">Total</th><th className="px-4 py-2.5 text-center">Grade</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const v = values[i]!;
              const shown = visible.some((x) => x.i === i);
              const ca = Number(v.ca), ex = Number(v.exam);
              const total = v.ca !== "" && v.exam !== "" && !Number.isNaN(ca) && !Number.isNaN(ex) ? Math.round((ca + ex) * 100) / 100 : null;
              const err = rejectedBy.get(r.matricNo);
              return (
                <tr key={r.registrationId} className={`border-t border-line ${shown ? "" : "hidden"} ${err ? "bg-bad/5" : ""}`}>
                  <td className="whitespace-nowrap px-4 py-1.5 font-mono text-[13px]">
                    <input type="hidden" name="matric" value={r.matricNo} />
                    {r.matricNo}
                    {err ? <div className="font-sans text-xs text-bad">{err}</div> : null}
                  </td>
                  <td className="px-2 py-1.5">{r.name}{r.publishedTotal != null ? <span className="ml-1 text-xs text-muted">(published: {r.publishedTotal})</span> : null}</td>
                  <td className="px-2 py-1.5 text-right">
                    <input name="ca" inputMode="decimal" disabled={!editable} value={v.ca} onChange={(e) => set(i, "ca", e.target.value)} aria-label={`CA for ${r.matricNo}`} className="w-20 rounded-md border border-line px-2 py-1.5 text-right tabular-nums disabled:bg-canvas" />
                  </td>
                  <td className="px-2 py-1.5 text-right">
                    <input name="exam" inputMode="decimal" disabled={!editable} value={v.exam} onChange={(e) => set(i, "exam", e.target.value.toUpperCase())} aria-label={`Exam for ${r.matricNo}`} className="w-20 rounded-md border border-line px-2 py-1.5 text-right tabular-nums disabled:bg-canvas" />
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{v.exam === "ABS" ? "ABS" : total ?? "—"}</td>
                  <td className="px-4 py-1.5 text-center font-semibold">{v.exam === "ABS" ? "—" : total != null && total <= 100 ? previewGrade(total) : r.grade ?? "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {editable ? (
        <div className="flex flex-col gap-3 border-t border-line px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm" role="status">
            {state?.error ? <span className="text-bad">{state.error}</span> : null}
            {state?.saved != null ? <span className="text-good">Saved {state.saved} row(s) as draft.</span> : null}
            {state?.rejected?.length ? <span className="ml-2 text-bad">{state.rejected.length} row(s) need fixing (highlighted).</span> : null}
          </div>
          <SubmitButton className="btn-primary">Save draft</SubmitButton>
        </div>
      ) : null}
    </form>
  );
}

export function UploadPanel({ offeringId }: { offeringId: string }) {
  const [preview, previewAction] = useActionState<UploadState, FormData>(previewUpload.bind(null, offeringId), { phase: "idle" });
  const [commit, commitAction] = useActionState<UploadState, FormData>(commitUpload.bind(null, offeringId), { phase: "idle" });
  const [file, setFile] = useState<File | null>(null);

  return (
    <section className="card p-5">
      <h2 className="font-semibold">Upload a result sheet</h2>
      <p className="mt-1 text-sm text-muted">CSV or Excel (.xlsx), up to 5 MB. Nothing is saved until you confirm the preview.</p>
      <a href={`/staff/courses/${offeringId}/template`} className="mt-2 inline-block text-sm font-medium text-royal">Download template with class list ↓</a>

      <form action={previewAction} className="mt-4 flex flex-col gap-3 sm:flex-row">
        <input name="file" type="file" required accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="input file:mr-3 file:rounded-md file:border-0 file:bg-canvas file:px-3 file:py-1 file:text-sm file:font-medium" />
        <SubmitButton className="btn-ghost shrink-0">Check file</SubmitButton>
      </form>

      {preview.phase === "error" ? <p role="alert" className="mt-3 text-sm text-bad">{preview.message}</p> : null}

      {preview.phase === "preview" && commit.phase !== "done" ? (
        <div className="mt-4 rounded-lg border border-line">
          <div className="grid grid-cols-3 divide-x divide-line text-center text-sm">
            <div className="p-3"><div className="text-xl font-semibold text-good tabular-nums">{preview.result.accepted.length}</div>ready</div>
            <div className="p-3"><div className="text-xl font-semibold text-bad tabular-nums">{preview.result.rejected.length}</div>rejected</div>
            <div className="p-3"><div className="text-xl font-semibold tabular-nums">{preview.result.missing.length}</div>not in file</div>
          </div>
          {preview.result.rejected.length ? (
            <ul className="max-h-48 overflow-auto border-t border-line px-4 py-2 text-xs">
              {preview.result.rejected.map((r) => <li key={r.row} className="py-1"><strong>Row {r.row}</strong> {r.matricNo}: {r.errors.join("; ")}</li>)}
            </ul>
          ) : null}
          {preview.result.missing.length ? (
            <p className="border-t border-line px-4 py-2 text-xs text-muted">Registered but not in the file: {preview.result.missing.slice(0, 12).join(", ")}{preview.result.missing.length > 12 ? ` and ${preview.result.missing.length - 12} more` : ""}</p>
          ) : null}
          <form
            action={(fd) => { if (file) fd.set("file", file); fd.set("confirm", "yes"); return commitAction(fd); }}
            className="flex flex-col gap-2 border-t border-line p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <p className="text-xs text-muted">Saving writes {preview.result.accepted.length} row(s) as draft in one step. Rejected rows are skipped.</p>
            <SubmitButton className="btn-primary shrink-0">Save {preview.result.accepted.length} rows</SubmitButton>
          </form>
        </div>
      ) : null}
      {commit.phase === "error" ? <p role="alert" className="mt-3 text-sm text-bad">{commit.message}</p> : null}
      {commit.phase === "done" ? <p role="status" className="mt-3 text-sm text-good">Saved {commit.accepted} row(s){commit.rejected ? `; ${commit.rejected} rejected row(s) were skipped` : ""}. Reload to see them in the score sheet.</p> : null}
    </section>
  );
}

export function WorkflowPanel({ offeringId, canForward, canReturn, canCorrect, forwardLabel }: { offeringId: string; canForward: boolean; canReturn: boolean; canCorrect: boolean; forwardLabel: string }) {
  const [state, action] = useActionState<FlowState, FormData>(moveSubmission.bind(null, offeringId), undefined);
  const [cstate, caction] = useActionState<FlowState, FormData>(startCorrection.bind(null, offeringId), undefined);
  const [mode, setMode] = useState<"none" | "return">("none");
  if (!canForward && !canReturn && !canCorrect) return null;

  return (
    <section className="card p-5">
      <h2 className="font-semibold">Your action</h2>
      {canForward || canReturn ? (
        <form action={action} className="mt-3 space-y-3">
          {mode === "return" ? (
            <>
              <label className="label" htmlFor="reason">Reason for returning (required)</label>
              <textarea id="reason" name="reason" required minLength={10} rows={3} className="input" placeholder="e.g. Exam scores missing for 3 students; CSC/23/0045 CA exceeds 40." />
              <input type="hidden" name="action" value="return" />
              <div className="flex gap-2"><SubmitButton className="btn-danger">Return to lecturer</SubmitButton><button type="button" className="btn-ghost" onClick={() => setMode("none")}>Cancel</button></div>
            </>
          ) : (
            <div className="flex flex-wrap gap-2">
              {canForward ? (
                <>
                  <input type="hidden" name="action" value="forward" />
                  <SubmitButton className="btn-primary">{forwardLabel}</SubmitButton>
                </>
              ) : null}
              {canReturn ? <button type="button" className="btn-danger" onClick={() => setMode("return")}>Return for correction</button> : null}
            </div>
          )}
          {state?.error ? <p role="alert" className="text-sm text-bad">{state.error}</p> : null}
          {state?.ok ? <p role="status" className="text-sm text-good">{state.ok}</p> : null}
        </form>
      ) : null}
      {canCorrect ? (
        <form action={caction} className="mt-3 space-y-3">
          <p className="text-sm text-muted">Published results cannot be edited. Re-open them for an authorised correction; the old version is kept and students keep seeing it until the correction is published.</p>
          <textarea name="reason" required minLength={20} rows={3} className="input" placeholder="What is wrong, and the evidence (e.g. script re-marked, memo ref.)" />
          <SubmitButton className="btn-danger">Re-open for correction</SubmitButton>
          {cstate?.error ? <p role="alert" className="text-sm text-bad">{cstate.error}</p> : null}
          {cstate?.ok ? <p role="status" className="text-sm text-good">{cstate.ok}</p> : null}
        </form>
      ) : null}
    </section>
  );
}
