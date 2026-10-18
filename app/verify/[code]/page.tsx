import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";
import { clientIp } from "@/lib/auth/session";
import { hit, LIMITS } from "@/lib/auth/rate-limit";
import { verifyStatement } from "@/lib/services/verify";
import { audit } from "@/lib/audit";

export const metadata = { title: "Statement verification", robots: { index: false } };
export const dynamic = "force-dynamic";

const STATUS = {
  VALID: { label: "Valid", cls: "bg-good/10 text-good", note: "This statement matches the published record." },
  SUPERSEDED: { label: "Superseded", cls: "bg-warn/10 text-warn", note: "A correction was published after this statement was issued. Ask the holder for a current statement." },
  REVOKED: { label: "Revoked", cls: "bg-bad/10 text-bad", note: "This statement has been withdrawn by the Faculty." },
} as const;

export default async function VerifyCode({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const ip = await clientIp();
  const rl = await hit(`verify:${ip ?? "unknown"}`, LIMITS.verifyPerIp.limit, LIMITS.verifyPerIp.windowMs);
  if (rl.limited) {
    return <AuthShell title="Too many lookups" subtitle={`Please wait ${rl.retryAfterSec} seconds and try again.`}><span /></AuthShell>;
  }
  const r = await verifyStatement(code);
  await audit({ action: r ? "statement.verified" : "statement.verifyMiss", entity: "Statement", entityId: code.slice(0, 26), ip });

  if (!r) {
    return (
      <AuthShell title="Not found" subtitle="No statement matches this reference. Check every character, or ask the holder for the QR code.">
        <Link href="/verify" className="btn-ghost w-full">Try another reference</Link>
      </AuthShell>
    );
  }
  const s = STATUS[r.status];
  return (
    <AuthShell title="Statement verification">
      <div className="card overflow-hidden">
        <div className={`px-5 py-4 ${s.cls}`}>
          <div className="text-xs font-semibold uppercase tracking-wider">Status</div>
          <div className="text-2xl font-semibold">{s.label}</div>
          <p className="mt-1 text-sm">{s.note}</p>
        </div>
        <dl className="divide-y divide-line text-sm">
          {[
            ["Holder", r.name],
            ["Programme", r.programme],
            ["Statement", r.type === "SEMESTER" ? `Semester — ${r.period}` : `Cumulative to ${r.period}`],
            ["CGPA at issue", r.cgpa],
            ["Issued", r.issuedAt.toLocaleDateString("en-NG", { dateStyle: "long" })],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4 px-5 py-3"><dt className="text-muted">{k}</dt><dd className="text-right font-medium">{v}</dd></div>
          ))}
        </dl>
      </div>
      <p className="mt-4 text-xs text-muted">Only the minimum details are shown. Course-level results are not disclosed on this page.</p>
    </AuthShell>
  );
}
