import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth-shell";

export const metadata = { title: "Verify a statement" };

async function go(form: FormData) {
  "use server";
  const code = String(form.get("code") ?? "").replace(/[^a-z2-7]/gi, "").toUpperCase().slice(0, 26);
  redirect(`/verify/${code}`);
}

export default function VerifyIndex() {
  return (
    <AuthShell title="Verify a result statement" subtitle="Enter the 26-character reference printed on the statement, or scan its QR code.">
      <form action={go} className="space-y-4">
        <div>
          <label className="label" htmlFor="code">Verification reference</label>
          <input id="code" name="code" required minLength={26} maxLength={40} className="input font-mono uppercase tracking-wider" autoComplete="off" />
        </div>
        <button className="btn-primary w-full">Verify</button>
      </form>
    </AuthShell>
  );
}
