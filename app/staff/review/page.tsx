import { requireUser } from "@/lib/auth/session";
import { reviewQueue } from "@/lib/services/results";
import { OfferingList } from "@/components/offering-list";
import { PageHeader } from "@/components/ui";

export const metadata = { title: "Review queue" };

export default async function ReviewPage() {
  const me = await requireUser(["DEPT_RESULT_OFFICER", "HOD", "FACULTY_ADMIN"]);
  const rows = await reviewQueue(me);
  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Approvals" title="Waiting for your decision" />
      <OfferingList rows={rows} empty="Nothing is waiting for you right now." />
    </div>
  );
}
