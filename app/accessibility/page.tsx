import { LegalPage } from "@/components/legal-page";

export const metadata = { title: "Accessibility" };

export default function Accessibility() {
  return (
    <LegalPage title="Accessibility statement" updated="18 October 2026">
      <p>We aim to meet WCAG 2.2 level AA.</p>
      <ul>
        <li>Every page works with a keyboard alone and shows a visible focus outline.</li>
        <li>Result tables use proper headers; every chart has a table alternative.</li>
        <li>Text and controls meet a contrast ratio of at least 4.5:1.</li>
        <li>Result pages render on the server and work on slow connections and with JavaScript turned off.</li>
      </ul>
      <p>If something does not work for you, contact your department office and describe the page and the problem. We will provide the information in another format.</p>
    </LegalPage>
  );
}
