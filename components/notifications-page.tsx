import Link from "next/link";
import { db } from "@/lib/db";
import { listNotifications } from "@/lib/services/notify";
import { EmptyState, PageHeader } from "./ui";

/** Shared by students and staff; marks everything read when viewed. */
export async function NotificationsPage({ userId }: { userId: string }) {
  const items = await listNotifications(userId);
  await db.notification.updateMany({ where: { userId, readAt: null }, data: { readAt: new Date() } });
  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Inbox" title="Notifications" />
      {items.length === 0 ? (
        <EmptyState title="You're all caught up" />
      ) : (
        <ul className="card divide-y divide-line">
          {items.map((n) => (
            <li key={n.id} className="flex gap-3 px-5 py-4">
              <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.readAt ? "bg-transparent" : "bg-royal"}`} aria-label={n.readAt ? undefined : "Unread"} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap justify-between gap-2">
                  <p className="font-medium">{n.href ? <Link href={n.href} className="hover:text-royal">{n.title}</Link> : n.title}</p>
                  <time className="text-xs text-muted">{n.createdAt.toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" })}</time>
                </div>
                <p className="mt-0.5 text-sm text-muted">{n.body}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
