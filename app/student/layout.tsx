import { AppShell } from "@/components/app-shell";
import type { NavItem } from "@/components/nav-links";
import { requireUser } from "@/lib/auth/session";
import { unreadCount } from "@/lib/services/notify";

const nav: NavItem[] = [
  { href: "/student", label: "Dashboard", icon: "home" },
  { href: "/student/results", label: "Results", icon: "results" },
  { href: "/student/history", label: "History", icon: "history" },
  { href: "/student/account", label: "Security", icon: "shield" },
];

export const dynamic = "force-dynamic";

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const me = await requireUser(["STUDENT"]);
  return (
    <AppShell nav={nav} user={{ displayName: me.displayName, username: me.username, roleLabel: "Student" }} unread={await unreadCount(me.userId)}>
      {children}
    </AppShell>
  );
}
