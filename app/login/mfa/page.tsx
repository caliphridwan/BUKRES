import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth-shell";
import { MfaForm } from "@/components/forms";
import { getSessionUser } from "@/lib/auth/session";
import { verifyMfa } from "../actions";

export const metadata = { title: "Two-step verification" };

export default async function MfaPage() {
  const me = await getSessionUser();
  if (!me) redirect("/login");
  if (me.mfaPassed) redirect("/staff");
  return (
    <AuthShell title="Two-step verification" subtitle="Enter the 6-digit code from your authenticator app.">
      <MfaForm action={verifyMfa} />
    </AuthShell>
  );
}
