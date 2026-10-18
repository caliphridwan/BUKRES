import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";
import { ActivateForm } from "@/components/forms";
import { activate } from "../login/actions";

export const metadata = { title: "Activate your account" };

export default function ActivatePage() {
  return (
    <AuthShell
      title="Activate your account"
      subtitle="You need the one-time activation code issued by your department."
      footer={<span>Already activated? <Link className="font-medium text-royal" href="/login">Sign in</Link></span>}
    >
      <ActivateForm action={activate} />
    </AuthShell>
  );
}
