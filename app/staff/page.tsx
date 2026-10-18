import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { listOfferingsFor, reviewQueue } from "@/lib/services/results";
import { activePolicy } from "@/lib/settings";
import { OfferingList } from "@/components/offering-list";
import { Alert, PageHeader, StatCard } from "@/components/ui";

export const metadata = { title: "Staff overview" };

export default async function StaffHome() {
  const me = await requireUser();
  if (me.role === "SUPER_ADMIN") {
    return (
      <div className="space-y-5">
        <PageHeader eyebrow="System" title="Super administrator" />
        <Alert>
          This role manages configuration, administrators and security. It has no access to individual academic records by design. Use the audit log to review activity.
        </Alert>
        <Link href="/staff/audit" className="btn-primary">Open audit log</Link>
      </div>
    );
  }

  const [all, queue, scale] = await Promise.all([listOfferingsFor(me), reviewQueue(me), activePolicy()]);
  const drafts = all.filter((o) => o.stage === "DRAFT");
  const inFlight = all.filter((o) => o.stage !== "DRAFT" && o.stage !== "PUBLISHED");
  const published = all.filter((o) => o.stage === "PUBLISHED");

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Overview" title={`Good day, ${me.displayName}`} />
      {!scale.confirmed && me.role === "FACULTY_ADMIN" ? (
        <Alert tone="warn">The active grading scale is marked <strong>unconfirmed</strong>. Confirm the bands and repeat policy with the Faculty before publishing real results.</Alert>
      ) : null}

      <section className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Waiting on you" value={queue.length + (me.role === "LECTURER" || me.role === "DEPT_RESULT_OFFICER" ? drafts.length : 0)} accent />
        <StatCard label="Drafts" value={drafts.length} />
        <StatCard label="In approval" value={inFlight.length} />
        <StatCard label="Published" value={published.length} />
      </section>

      {queue.length ? (
        <section>
          <h2 className="mb-3 font-semibold">Needs your decision</h2>
          <OfferingList rows={queue} empty="" />
        </section>
      ) : null}

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">{me.role === "LECTURER" ? "Your courses" : "Courses in progress"}</h2>
          <Link href="/staff/courses" className="text-sm font-medium text-royal">All courses →</Link>
        </div>
        <OfferingList rows={[...drafts, ...inFlight].slice(0, 10)} empty="No courses in progress." />
      </section>
    </div>
  );
}
