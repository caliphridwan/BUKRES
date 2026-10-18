import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { listStudents } from "@/lib/services/admin";
import { Badge, PageHeader } from "@/components/ui";
import { AddStudentForm, ReissueButton } from "./client";

export const metadata = { title: "Students" };

export default async function StudentsAdmin({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const me = await requireUser(["FACULTY_ADMIN"]);
  const sp = await searchParams;
  const q = (sp.q ?? "").slice(0, 60);
  const page = Math.max(1, Number(sp.page) || 1);
  const [{ rows, total, pages }, programmes] = await Promise.all([
    listStudents(me, q, page),
    db.programme.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Administration" title="Student accounts" />

      <details className="card p-5">
        <summary className="cursor-pointer font-semibold">Add a student</summary>
        <div className="mt-4"><AddStudentForm programmes={programmes} /></div>
      </details>

      <form className="flex gap-2" role="search">
        <input name="q" defaultValue={q} placeholder="Search matric number or name" className="input max-w-sm" aria-label="Search students" />
        <button className="btn-ghost">Search</button>
      </form>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-canvas text-left text-xs uppercase tracking-wide text-muted">
            <tr><th className="px-4 py-2.5">Matric no.</th><th className="px-2 py-2.5">Name</th><th className="px-2 py-2.5">Programme</th><th className="px-2 py-2.5">Level</th><th className="px-2 py-2.5">Account</th><th className="px-4 py-2.5">Activation</th></tr>
          </thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s.id} className="border-t border-line align-top">
                <td className="whitespace-nowrap px-4 py-3 font-mono text-[13px]">{s.matricNo}</td>
                <td className="px-2 py-3">{s.surname}, {s.firstName}</td>
                <td className="px-2 py-3 text-muted">{s.programme.name}</td>
                <td className="px-2 py-3 tabular-nums">{s.currentLevel}</td>
                <td className="px-2 py-3"><Badge tone={s.user.status === "ACTIVE" ? "good" : s.user.status === "SUSPENDED" ? "bad" : "warn"}>{s.user.status.replace("_", " ").toLowerCase()}</Badge></td>
                <td className="px-4 py-3"><ReissueButton studentId={s.id} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <nav aria-label="Pages" className="flex items-center justify-between text-sm text-muted">
        <span>{total} student(s)</span>
        <span className="flex gap-2">
          {page > 1 ? <Link className="btn-ghost px-3 py-1.5" href={`?q=${encodeURIComponent(q)}&page=${page - 1}`}>Previous</Link> : null}
          {page < pages ? <Link className="btn-ghost px-3 py-1.5" href={`?q=${encodeURIComponent(q)}&page=${page + 1}`}>Next</Link> : null}
        </span>
      </nav>
      <p className="text-xs text-muted">Issuing a code resets the student&apos;s password and signs them out. Hand the code over in person or through the department; never by public notice.</p>
    </div>
  );
}
