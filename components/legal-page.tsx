import Link from "next/link";
import { BrandLockup } from "./brand-mark";

export function LegalPage({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-4 py-5 sm:px-6">
        <Link href="/"><BrandLockup compact /></Link>
      </header>
      <main id="main" className="mx-auto max-w-3xl px-4 pb-16 sm:px-6">
        <article className="card p-6 sm:p-8 [&_h2]:mt-6 [&_h2]:font-semibold [&_li]:mt-1 [&_p]:mt-3 [&_p]:text-sm [&_p]:text-ink/85 [&_ul]:mt-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:text-sm">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-1! text-xs! text-muted!">Last updated {updated} · Draft for Faculty review</p>
          {children}
        </article>
      </main>
    </div>
  );
}
