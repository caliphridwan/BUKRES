"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import type { FormState } from "@/app/login/actions";

type Action = (state: FormState, form: FormData) => Promise<FormState>;

export function SubmitButton({ children, className = "btn-primary w-full" }: { children: React.ReactNode; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending} aria-busy={pending}>
      {pending ? "Please wait…" : children}
    </button>
  );
}

function Message({ state }: { state: FormState }) {
  if (state?.error) return <p role="alert" className="rounded-lg border border-bad/25 bg-bad/5 px-3 py-2 text-sm text-bad">{state.error}</p>;
  if (state?.ok) return <p role="status" className="rounded-lg border border-good/25 bg-good/5 px-3 py-2 text-sm text-good">{state.ok}</p>;
  return null;
}

function PasswordInput({ name, label, autoComplete }: { name: string; label: string; autoComplete: string }) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <label className="label" htmlFor={name}>{label}</label>
      <div className="relative">
        <input id={name} name={name} type={show ? "text" : "password"} required autoComplete={autoComplete} className="input pr-16" maxLength={128} />
        <button type="button" onClick={() => setShow((s) => !s)} className="absolute inset-y-0 right-0 px-3 text-xs font-medium text-royal" aria-pressed={show}>
          {show ? "Hide" : "Show"}
        </button>
      </div>
    </div>
  );
}

export function LoginForm({ action, as }: { action: Action; as: "student" | "staff" }) {
  const [state, formAction] = useActionState(action, undefined);
  return (
    <form action={formAction} className="space-y-4" noValidate>
      <input type="hidden" name="as" value={as} />
      <div>
        <label className="label" htmlFor="username">{as === "student" ? "Matric number" : "Staff number"}</label>
        <input
          id="username" name="username" required autoComplete="username" className="input uppercase" autoCapitalize="characters"
          placeholder={as === "student" ? "e.g. CST/23/COM/00123" : "e.g. SP/1234"} defaultValue={state?.fields?.username}
        />
      </div>
      <PasswordInput name="password" label="Password" autoComplete="current-password" />
      <Message state={state} />
      <SubmitButton>Sign in</SubmitButton>
    </form>
  );
}

export function ActivateForm({ action }: { action: Action }) {
  const [state, formAction] = useActionState(action, undefined);
  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label className="label" htmlFor="username">Matric or staff number</label>
        <input id="username" name="username" required className="input uppercase" defaultValue={state?.fields?.username} autoComplete="username" />
      </div>
      <div>
        <label className="label" htmlFor="code">Activation code</label>
        <input id="code" name="code" required className="input font-mono uppercase tracking-widest" placeholder="XXXX-XXXX-XXXX" autoComplete="one-time-code" />
        <p className="mt-1 text-xs text-muted">Issued by your department. It works once and expires.</p>
      </div>
      <div>
        <label className="label" htmlFor="email">Email address</label>
        <input id="email" name="email" type="email" required className="input" defaultValue={state?.fields?.email} autoComplete="email" />
        <p className="mt-1 text-xs text-muted">Used for password recovery and publication alerts. Results are never sent by email.</p>
      </div>
      <PasswordInput name="password" label="New password (10+ characters)" autoComplete="new-password" />
      <PasswordInput name="confirm" label="Confirm password" autoComplete="new-password" />
      <Message state={state} />
      <SubmitButton>Activate account</SubmitButton>
    </form>
  );
}

export function MfaForm({ action }: { action: Action }) {
  const [state, formAction] = useActionState(action, undefined);
  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label className="label" htmlFor="code">6-digit code</label>
        <input id="code" name="code" inputMode="numeric" pattern="[0-9 ]{6,7}" required autoComplete="one-time-code" className="input text-center font-mono text-lg tracking-[0.4em]" />
      </div>
      <Message state={state} />
      <SubmitButton>Verify</SubmitButton>
    </form>
  );
}

export function ChangePasswordForm({ action }: { action: Action }) {
  const [state, formAction] = useActionState(action, undefined);
  return (
    <form action={formAction} className="max-w-md space-y-4">
      <PasswordInput name="current" label="Current password" autoComplete="current-password" />
      <PasswordInput name="password" label="New password" autoComplete="new-password" />
      <PasswordInput name="confirm" label="Confirm new password" autoComplete="new-password" />
      <Message state={state} />
      <SubmitButton className="btn-primary">Change password</SubmitButton>
    </form>
  );
}
