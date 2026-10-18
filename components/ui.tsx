import type { ReactNode } from "react";

export function StatCard({ label, value, hint, accent }: { label: string; value: ReactNode; hint?: ReactNode; accent?: boolean }) {
  return (
    <div className={`card p-4 sm:p-5 ${accent ? "border-navy/20 bg-gradient-to-b from-white to-canvas" : ""}`}>
      <div className="eyebrow">{label}</div>
      <div className="mt-2 text-2xl font-semibold tabular-nums text-ink sm:text-[28px]">{value}</div>
      {hint ? <div className="mt-1 text-xs text-muted">{hint}</div> : null}
    </div>
  );
}

const TONES = {
  good: "bg-good/10 text-good ring-good/20",
  bad: "bg-bad/10 text-bad ring-bad/20",
  warn: "bg-warn/10 text-warn ring-warn/25",
  info: "bg-royal/10 text-royal ring-royal/20",
  neutral: "bg-slate-100 text-muted ring-slate-200",
} as const;

export function Badge({ tone = "neutral", children }: { tone?: keyof typeof TONES; children: ReactNode }) {
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${TONES[tone]}`}>{children}</span>;
}

export function statusTone(status: string): keyof typeof TONES {
  switch (status) {
    case "Passed":
    case "Published":
      return "good";
    case "Failed":
      return "bad";
    case "Withheld":
    case "Absent":
    case "Incomplete":
      return "warn";
    case "Pending":
      return "neutral";
    default:
      return "info";
  }
}

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="card flex flex-col items-center px-6 py-12 text-center">
      <svg width="44" height="44" viewBox="0 0 44 44" aria-hidden className="mb-4 text-line">
        <rect x="8" y="6" width="28" height="32" rx="4" fill="none" stroke="currentColor" strokeWidth="2" />
        <path d="M14 15h16M14 21h16M14 27h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <h3 className="text-base font-semibold">{title}</h3>
      {children ? <div className="mt-1 max-w-md text-sm text-muted">{children}</div> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function PageHeader({ eyebrow, title, children }: { eyebrow?: string; title: string; children?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow ? <div className="eyebrow">{eyebrow}</div> : null}
        <h1 className="mt-1 text-xl font-semibold tracking-tight sm:text-2xl">{title}</h1>
      </div>
      {children ? <div className="no-print flex flex-wrap gap-2">{children}</div> : null}
    </div>
  );
}

export function Alert({ tone = "info", children }: { tone?: "info" | "bad" | "good" | "warn"; children: ReactNode }) {
  const cls = {
    info: "border-royal/20 bg-royal/5 text-navy",
    bad: "border-bad/25 bg-bad/5 text-bad",
    good: "border-good/25 bg-good/5 text-good",
    warn: "border-warn/30 bg-warn/5 text-warn",
  }[tone];
  return (
    <div role={tone === "bad" ? "alert" : "status"} className={`rounded-lg border px-4 py-3 text-sm ${cls}`}>
      {children}
    </div>
  );
}
