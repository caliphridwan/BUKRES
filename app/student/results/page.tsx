import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { getStudentRecord } from "@/lib/services/student";
import { ResultTable, GradeLegend } from "@/components/result-table";
import { EmptyState, PageHeader } from "@/components/ui";
import { PrintButton } from "@/components/print-button";

export const metadata = { title: "Results" };

export default async function ResultsPage({ searchParams }: { searchParams: Promise<{ semester?: string }> }) {
  const me = await requireUser(["STUDENT"]);
  const rec = await getStudentRecord(me.studentId!);
  const wanted = (await searchParams).semester;
  // Only semesters from the student's own record can be selected.
  const selected = rec.semesters.find((s) => s.semesterId === wanted) ?? rec.semesters.at(-1);

  if (!selected) {
    return (
      <>
        <PageHeader eyebrow="Results" title="Semester results" />
        <EmptyState title="No course registrations found">If you registered for courses this session, contact your department.</EmptyState>
      </>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Results" title="Semester results">
        <PrintButton />
        {selected.summary ? (
          <a className="btn-primary" href={`/student/statement?semester=${selected.semesterId}`}>Download PDF</a>
        ) : null}
      </PageHeader>

      <nav aria-label="Choose semester" className="no-print -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {[...rec.semesters].reverse().map((s) => (
          <Link
            key={s.semesterId}
            href={`/student/results?semester=${s.semesterId}`}
            aria-current={s.semesterId === selected.semesterId ? "page" : undefined}
            className={`whitespace-nowrap rounded-full border px-3.5 py-1.5 text-sm font-medium ${s.semesterId === selected.semesterId ? "border-navy bg-navy text-white" : "border-line bg-white text-muted hover:text-ink"}`}
          >
            {s.label}
          </Link>
        ))}
      </nav>

      <ResultTable sem={selected} showScores={rec.showScores} />
      <GradeLegend bands={rec.policy.bands} />
      <p className="text-xs text-muted">
        This page is a view of your published record. For an official copy, download the PDF statement — it carries a verification code anyone can check.
      </p>
    </div>
  );
}
