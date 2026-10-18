import { LegalPage } from "@/components/legal-page";

export const metadata = { title: "Terms of use" };

export default function Terms() {
  return (
    <LegalPage title="Terms of use" updated="18 October 2026">
      <p>By signing in you agree to these terms.</p>
      <ul>
        <li>Your account is personal. Do not share your password or activation code. You are responsible for activity on your account.</li>
        <li>Do not try to view, change or obtain records that are not yours. Every access is logged and misuse is reported to the University.</li>
        <li>The PDF statement is valid only while its verification page shows <strong>Valid</strong>. A statement superseded by a correction is no longer current.</li>
        <li>If you believe a result is wrong, contact your department. Results change only through the authorised correction process.</li>
        <li>The portal may be unavailable during maintenance; announcements appear on the home page.</li>
      </ul>
    </LegalPage>
  );
}
