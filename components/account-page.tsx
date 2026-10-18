import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { ChangePasswordForm } from "./forms";
import { PageHeader } from "./ui";
import { changePassword } from "@/app/login/actions";

export async function AccountPage() {
  const me = await requireUser();
  const [user, sessions] = await Promise.all([
    db.user.findUniqueOrThrow({ where: { id: me.userId }, select: { email: true, emailVerifiedAt: true, lastLoginAt: true } }),
    db.session.findMany({ where: { userId: me.userId }, orderBy: { lastSeenAt: "desc" }, take: 5, select: { id: true, userAgent: true, lastSeenAt: true, ip: true } }),
  ]);
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Account" title="Security settings" />
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card p-5 sm:p-6">
          <h2 className="font-semibold">Change password</h2>
          <p className="mb-4 mt-1 text-sm text-muted">At least 10 characters. Changing it signs out your other devices.</p>
          <ChangePasswordForm action={changePassword} />
        </section>
        <section className="card p-5 sm:p-6">
          <h2 className="font-semibold">Recovery email</h2>
          <p className="mt-1 text-sm">
            {user.email ?? "Not set"}{" "}
            {user.email ? (user.emailVerifiedAt ? <span className="text-good">· verified</span> : <span className="text-warn">· not verified</span>) : null}
          </p>
          <p className="mt-1 text-xs text-muted">Until verified, password recovery goes through your department office.</p>
          <h2 className="mt-6 font-semibold">Recent sign-ins</h2>
          <ul className="mt-2 divide-y divide-line text-sm">
            {sessions.map((s) => (
              <li key={s.id} className="flex justify-between gap-3 py-2">
                <span className="truncate text-muted">{s.userAgent?.split(")")[0]?.split("(")[1] ?? "Unknown device"}</span>
                <span className="whitespace-nowrap tabular-nums">{s.lastSeenAt.toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" })}{s.id === me.sessionId ? " · this device" : ""}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
