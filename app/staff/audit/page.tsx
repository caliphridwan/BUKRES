import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { auditPage } from "@/lib/services/admin";
import { PageHeader } from "@/components/ui";

export const metadata = { title: "Audit log" };

const FILTERS = [["", "All"], ["auth", "Sign-ins"], ["result", "Result changes"], ["submission", "Approvals"], ["statement", "Statements"], ["account", "Accounts"], ["export", "Exports"]];

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ page?: string; a?: string }> }) {
  const me = await requireUser(["FACULTY_ADMIN", "SUPER_ADMIN", "HOD", "DEPT_RESULT_OFFICER"]);
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const a = FILTERS.some(([k]) => k === sp.a) ? sp.a! : "";
  const { rows, total, pages } = await auditPage(me, page, a || undefined);

  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Security" title="Audit log" />
      <nav className="flex flex-wrap gap-2" aria-label="Filter">
        {FILTERS.map(([k, label]) => (
          <Link key={k} href={`?a=${k}`} className={`rounded-full border px-3 py-1 text-sm ${a === k ? "border-navy bg-navy text-white" : "border-line bg-white text-muted"}`}>{label}</Link>
        ))}
      </nav>
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-canvas text-left text-xs uppercase tracking-wide text-muted">
            <tr><th className="px-4 py-2.5">When</th><th className="px-2 py-2.5">Who</th><th className="px-2 py-2.5">Action</th><th className="px-2 py-2.5">Target</th><th className="px-4 py-2.5">IP</th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-line">
                <td className="whitespace-nowrap px-4 py-2 tabular-nums text-muted">{r.createdAt.toLocaleString("en-NG", { dateStyle: "short", timeStyle: "medium" })}</td>
                <td className="px-2 py-2 font-mono text-xs">{r.actor?.username ?? "—"}</td>
                <td className="px-2 py-2"><code className="text-xs">{r.action}</code></td>
                <td className="px-2 py-2 text-xs text-muted">{r.entity ? `${r.entity} ${r.entityId?.slice(0, 10) ?? ""}` : "—"}</td>
                <td className="px-4 py-2 font-mono text-xs text-muted">{r.ip ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <nav className="flex items-center justify-between text-sm text-muted" aria-label="Pages">
        <span>{total} event(s)</span>
        <span className="flex gap-2">
          {page > 1 ? <Link className="btn-ghost px-3 py-1.5" href={`?a=${a}&page=${page - 1}`}>Newer</Link> : null}
          {page < pages ? <Link className="btn-ghost px-3 py-1.5" href={`?a=${a}&page=${page + 1}`}>Older</Link> : null}
        </span>
      </nav>
    </div>
  );
}
