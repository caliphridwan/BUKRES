import { LegalPage } from "@/components/legal-page";

export const metadata = { title: "Privacy notice" };

export default function Privacy() {
  return (
    <LegalPage title="Privacy notice" updated="18 October 2026">
      <p>This portal processes personal data to publish examination results to the students they belong to. This draft follows the Nigeria Data Protection Act 2023 and must be approved by the University before the portal handles real records.</p>
      <h2>What we hold</h2>
      <ul>
        <li>Identity: name, matric or staff number, programme, level, email address you provide.</li>
        <li>Academic records: course registrations, scores, grades, GPA and CGPA once published.</li>
        <li>Security records: sign-in times, IP addresses, and actions on results (the audit log).</li>
      </ul>
      <h2>Who can see it</h2>
      <ul>
        <li>You see only your own published results.</li>
        <li>Lecturers see the courses assigned to them; department officers and HODs see their department; Faculty administrators see the Faculty.</li>
        <li>Anyone holding your statement&apos;s verification code sees only your name (partly masked), programme, period, CGPA and the statement&apos;s status.</li>
      </ul>
      <h2>Why (lawful basis)</h2>
      <p>Publishing results is part of the University&apos;s public academic function. We do not use your data for marketing and never sell or share it outside the University&apos;s authorised processors.</p>
      <h2>How long</h2>
      <ul>
        <li>Academic records: as long as University records policy requires.</li>
        <li>Audit logs: 7 years. Sign-in sessions: 30 days. Uploaded result files: 90 days (a fingerprint and summary are kept).</li>
      </ul>
      <h2>Your rights</h2>
      <p>You can ask for a copy of your data, ask for corrections through the result-correction process, and complain to the Nigeria Data Protection Commission. Contact your department office to make a request.</p>
    </LegalPage>
  );
}
