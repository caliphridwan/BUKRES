"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/forms";
import { addStudent, reissueCode, type CodeState } from "./actions";

function CodeSlip({ s }: { s: CodeState }) {
  if (s?.error) return <p role="alert" className="text-xs text-bad">{s.error}</p>;
  if (!s?.code) return null;
  return (
    <div role="status" className="rounded-lg border border-gold/40 bg-gold/10 p-3 text-sm">
      <div className="text-xs text-muted">Activation code for {s.matricNo} — shown once, valid {s.expiresInDays} days</div>
      <div className="mt-1 select-all font-mono text-lg font-semibold tracking-widest">{s.code}</div>
    </div>
  );
}

export function ReissueButton({ studentId }: { studentId: string }) {
  const [state, action] = useActionState<CodeState, FormData>(reissueCode.bind(null, studentId), undefined);
  return (
    <form action={action} className="space-y-2">
      {!state?.code ? <SubmitButton className="btn-ghost px-3 py-1.5 text-xs">Issue code</SubmitButton> : null}
      <CodeSlip s={state} />
    </form>
  );
}

export function AddStudentForm({ programmes }: { programmes: Array<{ id: string; name: string }> }) {
  const [state, action] = useActionState<CodeState, FormData>(addStudent, undefined);
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      <div><label className="label" htmlFor="matricNo">Matric number</label><input id="matricNo" name="matricNo" required className="input uppercase" /></div>
      <div><label className="label" htmlFor="programmeId">Programme</label>
        <select id="programmeId" name="programmeId" required className="input">{programmes.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
      </div>
      <div><label className="label" htmlFor="surname">Surname</label><input id="surname" name="surname" required className="input" /></div>
      <div><label className="label" htmlFor="firstName">First name</label><input id="firstName" name="firstName" required className="input" /></div>
      <div><label className="label" htmlFor="otherNames">Other names</label><input id="otherNames" name="otherNames" className="input" /></div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className="label" htmlFor="entryYear">Entry year</label><input id="entryYear" name="entryYear" type="number" required defaultValue={new Date().getFullYear()} className="input" /></div>
        <div><label className="label" htmlFor="currentLevel">Level</label>
          <select id="currentLevel" name="currentLevel" className="input">{[100, 200, 300, 400].map((l) => <option key={l}>{l}</option>)}</select>
        </div>
      </div>
      <div className="sm:col-span-2 flex flex-col gap-3"><SubmitButton className="btn-primary self-start">Add student & issue code</SubmitButton><CodeSlip s={state} /></div>
    </form>
  );
}
