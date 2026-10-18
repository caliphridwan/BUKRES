import Link from "next/link";
import { BrandLockup, PilotNotice } from "@/components/brand-mark";
import { brand } from "@/lib/brand";
import { getSetting } from "@/lib/settings";

export const revalidate = 300;

const steps = [
  { n: "1", t: "Activate once", d: "Use the activation code from your department with your matric number, then set a password." },
  { n: "2", t: "Sign in", d: "Sign in with your matric number from any phone or computer." },
  { n: "3", t: "View & download", d: "See published results, GPA and CGPA, and download a verifiable statement." },
];

const departments = [
  { name: "Computer Science", email: "hod.cs@buk.edu.ng" },
  { name: "Information Technology", email: "hod.it@buk.edu.ng" },
  { name: "Software Engineering", email: "hod.se@buk.edu.ng" },
];

export default async function Landing() {
  const banner = await getSetting("MAINTENANCE_BANNER").catch(() => "");
  return (
    <div className="flex min-h-dvh flex-col">
      {banner ? (
        <div role="status" className="bg-gold/15 px-4 py-2 text-center text-sm text-ink">{banner}</div>
      ) : null}
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
        <BrandLockup />
        <nav className="flex items-center gap-2">
          <Link href="/verify" className="hidden text-sm font-medium text-muted hover:text-navy sm:inline">Verify a statement</Link>
          <Link href="/login?as=staff" className="btn-ghost">Staff sign in</Link>
        </nav>
      </header>

      <main id="main" className="flex-1">
        <section className="relative overflow-hidden">
          <div className="absolute inset-x-0 top-0 -z-10 h-[520px] bg-[radial-gradient(60%_60%_at_70%_0%,rgba(29,95,167,0.12),transparent)]" />
          <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 pb-16 pt-8 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:pt-16">
            <div>
              <p className="eyebrow text-royal">Faculty of Computing · Results</p>
              <h1 className="mt-3 text-3xl font-semibold leading-tight tracking-tight text-navy sm:text-[44px] sm:leading-[1.1]">
                Your Academic Journey.
                <br />
                Clearly Presented. <span className="text-royal">Securely Accessible.</span>
              </h1>
              <p className="mt-5 max-w-xl text-base text-muted">
                Check your published examination results, semester GPA and CGPA privately — no more crowding at the notice board.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/login" className="btn-primary px-6 py-3">Student sign in</Link>
                <Link href="/activate" className="btn-ghost px-6 py-3">Activate my account</Link>
              </div>
              <div className="mt-6"><PilotNotice /></div>
            </div>

            <div className="card p-5 sm:p-6" aria-hidden>
              <div className="flex items-center justify-between">
                <div>
                  <div className="eyebrow">Sample dashboard</div>
                  <div className="mt-1 text-sm font-semibold">2025/2026 · First Semester</div>
                </div>
                <span className="rounded-full bg-good/10 px-2 py-0.5 text-xs font-medium text-good">Published</span>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-canvas p-4"><div className="eyebrow">GPA</div><div className="mt-1 text-2xl font-semibold tabular-nums">4.21</div></div>
                <div className="rounded-xl bg-navy p-4 text-white"><div className="text-xs font-semibold uppercase tracking-wider text-white/70">CGPA</div><div className="mt-1 text-2xl font-semibold tabular-nums">3.98</div></div>
              </div>
              <svg viewBox="0 0 300 90" className="mt-5 w-full">
                <polyline points="10,70 80,55 150,60 220,35 290,22" fill="none" stroke="#1D5FA7" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                {[[10, 70], [80, 55], [150, 60], [220, 35], [290, 22]].map(([x, y]) => <circle key={x} cx={x} cy={y} r="3.5" fill="#fff" stroke="#1D5FA7" strokeWidth="2" />)}
              </svg>
              <p className="mt-2 text-xs text-muted">Illustration only — not real student data.</p>
            </div>
          </div>
        </section>

        <section className="border-y border-line bg-white">
          <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
            <h2 className="text-lg font-semibold">How to check your results</h2>
            <ol className="mt-6 grid gap-4 sm:grid-cols-3">
              {steps.map((s) => (
                <li key={s.n} className="rounded-xl border border-line p-5">
                  <span className="grid h-8 w-8 place-items-center rounded-full bg-navy text-sm font-semibold text-white">{s.n}</span>
                  <h3 className="mt-3 font-semibold">{s.t}</h3>
                  <p className="mt-1 text-sm text-muted">{s.d}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="mx-auto grid max-w-6xl gap-6 px-4 py-12 sm:px-6 md:grid-cols-2">
          <div>
            <h2 className="text-lg font-semibold">Help & support</h2>
            <p className="mt-2 text-sm text-muted">Lost your activation code, or think a result is wrong? Contact your department.</p>
            <ul className="mt-4 space-y-2 text-sm">
              {departments.map((d) => (
                <li key={d.name} className="flex justify-between gap-4 rounded-lg border border-line bg-white px-4 py-3">
                  <span>{d.name}</span>
                  <a className="font-medium text-royal" href={`mailto:${d.email}`}>{d.email}</a>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className="text-lg font-semibold">Your privacy</h2>
            <p className="mt-2 text-sm text-muted">
              Only you can see your results after signing in. Staff see only the courses they are responsible for. Every access to a result is logged. Results are never sent by email or shown on public pages.
            </p>
            <Link href="/privacy" className="mt-3 inline-block text-sm font-medium text-royal">Read the privacy notice →</Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-line bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-6 text-xs text-muted sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <span>{brand.name} · {brand.institution}</span>
          <nav className="flex gap-4">
            <Link href="/privacy">Privacy</Link>
            <Link href="/terms">Terms of use</Link>
            <Link href="/accessibility">Accessibility</Link>
            <Link href="/verify">Verify a statement</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
