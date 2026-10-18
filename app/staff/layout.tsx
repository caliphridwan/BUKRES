import { AppShell } from "@/components/app-shell";
import type { NavItem } from "@/components/nav-links";
import { requireUser, STAFF_ROLES } from "@/lib/auth/session";
import { unreadCount } from "@/lib/services/notify";

export const dynamic = "force-dynamic";

const ROLE_LABEL: Record<string, string> = {
  LECTURER: "Lecturer",
  DEPT_RESULT_OFFICER: "Dept. Result Officer",
  HOD: "Head of Department",
  FACULTY_ADMIN: "Faculty Administrator",
  SUPER_ADMIN: "Super Administrator",
};

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const me = await requireUser(STAFF_ROLES);
  const nav: NavItem[] = [
    { href: "/staff", label: "Overview", icon: "home" },
    { href: "/staff/courses", label: "Courses", icon: "courses" },
  ];
  if (me.role !== "LECTURER" && me.role !== "SUPER_ADMIN") nav.push({ href: "/staff/review", label: "Review", icon: "inbox" });
  if (me.role === "FACULTY_ADMIN") nav.push({ href: "/staff/students", label: "Students", icon: "users" });
  if (["FACULTY_ADMIN", "SUPER_ADMIN", "HOD", "DEPT_RESULT_OFFICER"].includes(me.role)) nav.push({ href: "/staff/audit", label: "Audit log", icon: "log" });
  nav.push({ href: "/staff/account", label: "Security", icon: "shield" });

  return (
    <AppShell nav={nav} user={{ displayName: me.displayName, username: me.username, roleLabel: ROLE_LABEL[me.role] ?? me.role }} unread={await unreadCount(me.userId)}>
      {children}
    </AppShell>
  );
}
