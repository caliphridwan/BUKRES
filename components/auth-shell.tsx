import Link from "next/link";
import { BrandLockup, PilotNotice } from "./brand-mark";

export function AuthShell({ title, subtitle, children, footer }: { title: string; subtitle?: string; children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1fr_minmax(420px,520px)]">
      <aside className="relative hidden overflow-hidden bg-navy p-10 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full border-[40px] border-white/5" />
        <div className="absolute -bottom-32 -left-16 h-80 w-80 rounded-full border-[28px] border-gold/10" />
        <Link href="/" className="relative text-sm font-semibold text-white/80 hover:text-white">← Back to portal home</Link>
        <div className="relative max-w-md">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">Faculty of Computing</p>
          <p className="mt-4 text-3xl font-semibold leading-snug">Your Academic Journey. Clearly Presented. Securely Accessible.</p>
          <p className="mt-4 text-sm text-white/70">Computer Science · Information Technology · Software Engineering</p>
        </div>
        <p className="relative text-xs text-white/50">Access is logged. Never share your password or activation code.</p>
      </aside>
      <main id="main" className="flex flex-col justify-center px-5 py-10 sm:px-10">
        <div className="mx-auto w-full max-w-sm">
          <BrandLockup />
          <h1 className="mt-8 text-2xl font-semibold tracking-tight">{title}</h1>
          {subtitle ? <p className="mt-1 text-sm text-muted">{subtitle}</p> : null}
          <div className="mt-6">{children}</div>
          {footer ? <div className="mt-6 text-sm text-muted">{footer}</div> : null}
          <div className="mt-8"><PilotNotice /></div>
        </div>
      </main>
    </div>
  );
}
