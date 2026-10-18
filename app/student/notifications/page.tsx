import { requireUser } from "@/lib/auth/session";
import { NotificationsPage } from "@/components/notifications-page";

export const metadata = { title: "Notifications" };

export default async function Page() {
  const me = await requireUser(["STUDENT"]);
  return <NotificationsPage userId={me.userId} />;
}
