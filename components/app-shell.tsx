import Link from "next/link";
import { BrandLockup, PilotNotice } from "./brand-mark";
import { NavLinks, type NavItem } from "./nav-links";
import { logout } from "@/app/login/actions";

export function AppShell({
  nav,
  user,
  unread,
  children,
}: {
  nav: NavItem[];
  user: { displayName: string; username: string; roleLabel: string };
  unread: number;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[260px_1fr]">
      {/* Desktop sidebar */}
      <aside className="no-print sticky top-0 hidden h-dvh flex-col border-r border-line bg-white px-4 py-5 lg:flex">
        <div className="px-2"><BrandLockup compact /></div>
        <nav aria-label="Main" className="mt-8 flex-1"><NavLinks items={nav} variant="side" /></nav>
        <div className="rounded-xl border border-line p-3">
          <div className="truncate text-sm font-semibold">{user.displayName}</div>
          <div className="truncate text-xs text-muted">{user.username} · {user.roleLabel}</div>
          <form action={logout} className="mt-3">
            <button className="btn-ghost w-full py-2">Sign out</button>
          </form>
        </div>
      </aside>

      <div className="flex min-h-dvh flex-col pb-20 lg:pb-0">
        {/* Top bar */}
        <header className="no-print sticky top-0 z-20 flex items-center justify-between border-b border-line bg-white/90 px-4 py-3 backdrop-blur sm:px-6">
          <div className="lg:hidden"><BrandLockup compact /></div>
          <div className="hidden text-sm text-muted lg:block">Welcome, <span className="font-medium text-ink">{user.displayName}</span></div>
          <div className="flex items-center gap-2">
            <Link href={nav[0]!.href.startsWith("/student") ? "/student/notifications" : "/staff/notifications"} className="relative rounded-lg p-2 text-muted hover:bg-canvas" aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden><path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
              {unread ? <span className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-bad px-1 text-[10px] font-semibold text-white">{unread > 9 ? "9+" : unread}</span> : null}
            </Link>
            <form action={logout} className="lg:hidden"><button className="rounded-lg px-2 py-2 text-sm font-medium text-muted">Sign out</button></form>
          </div>
        </header>

        <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8">{children}</main>
        <footer className="no-print mx-auto w-full max-w-6xl px-4 pb-6 sm:px-6"><PilotNotice /></footer>
      </div>

      {/* Mobile bottom navigation */}
      <nav aria-label="Main" className="no-print fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white px-2 pb-[env(safe-area-inset-bottom)] lg:hidden">
        <NavLinks items={nav.slice(0, 4)} variant="bottom" />
      </nav>
    </div>
  );
}
