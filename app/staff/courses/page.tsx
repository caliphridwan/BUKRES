import { requireUser } from "@/lib/auth/session";
import { listOfferingsFor } from "@/lib/services/results";
import { OfferingList } from "@/components/offering-list";
import { PageHeader } from "@/components/ui";

export const metadata = { title: "Courses" };

export default async function CoursesPage() {
  const me = await requireUser();
  const rows = await listOfferingsFor(me);
  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Courses" title={me.role === "LECTURER" ? "Courses assigned to you" : "Course results"} />
      <OfferingList rows={rows} empty="No course offerings are visible to your role." />
    </div>
  );
}
