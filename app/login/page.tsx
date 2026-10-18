import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth-shell";
import { LoginForm } from "@/components/forms";
import { getSessionUser } from "@/lib/auth/session";
import { login } from "./actions";

export const metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ as?: string }> }) {
  const me = await getSessionUser();
  if (me) redirect(me.role === "STUDENT" ? "/student" : "/staff");
  const as = (await searchParams).as === "staff" ? "staff" : "student";
  return (
    <AuthShell
      title={as === "student" ? "Student sign in" : "Staff sign in"}
      subtitle={as === "student" ? "Use your matric number and portal password." : "For lecturers, result officers, HODs and administrators."}
      footer={
        <div className="flex flex-col gap-2">
          {as === "student" ? (
            <>
              <span>First time here? <Link className="font-medium text-royal" href="/activate">Activate your account</Link></span>
              <span>Staff member? <Link className="font-medium text-royal" href="/login?as=staff">Staff sign in</Link></span>
            </>
          ) : (
            <span>Student? <Link className="font-medium text-royal" href="/login">Student sign in</Link></span>
          )}
          <span>Forgot your password? Contact your department office to issue a new activation code.</span>
        </div>
      }
    >
      <div role="tablist" aria-label="Account type" className="mb-5 grid grid-cols-2 rounded-lg bg-canvas p-1 text-sm font-medium">
        <Link role="tab" aria-selected={as === "student"} href="/login" className={`rounded-md py-2 text-center ${as === "student" ? "bg-white shadow-sm" : "text-muted"}`}>Student</Link>
        <Link role="tab" aria-selected={as === "staff"} href="/login?as=staff" className={`rounded-md py-2 text-center ${as === "staff" ? "bg-white shadow-sm" : "text-muted"}`}>Staff</Link>
      </div>
      <LoginForm action={login} as={as} />
    </AuthShell>
  );
}
