import Link from "next/link";

export default function NotFound() {
  return (
    <main id="main" className="grid min-h-dvh place-items-center px-6 text-center">
      <div>
        <p className="eyebrow">404</p>
        <h1 className="mt-2 text-2xl font-semibold">Page not found</h1>
        <p className="mt-2 text-sm text-muted">The page does not exist, or you do not have access to it.</p>
        <Link href="/" className="btn-primary mt-6">Go to the portal home</Link>
      </div>
    </main>
  );
}
