import { requireUser, STAFF_ROLES } from "@/lib/auth/session";
import { NotificationsPage } from "@/components/notifications-page";

export const metadata = { title: "Notifications" };

export default async function Page() {
  const me = await requireUser(STAFF_ROLES);
  return <NotificationsPage userId={me.userId} />;
}
