import { SUPPORT_EMAIL, SUPPORT_EMAIL_MAILTO } from "../../constants/support";
import { responsiveStyles } from "../responsiveStyles";
import LegalPageLayout, { type LegalPageProps } from "./LegalPageLayout";

export default function PrivacyPage({ isModal = false }: LegalPageProps) {
  return (
    <LegalPageLayout
      isModal={isModal}
      title="Privacy Policy"
      updatedAt="Last updated: April 16, 2026"
    >
      <section>
        <h2 className={responsiveStyles.legalSectionTitle}>1. Overview</h2>
        <p className="m-0">
          Routefy is a nurse-focused route planning and client management tool designed to support
          daily visit scheduling and operational workflows.
        </p>
        <p className="m-0 mt-2">
          We are committed to protecting the privacy and security of all personal information
          handled through the application.
        </p>
      </section>

      <section>
        <h2 className={responsiveStyles.legalSectionTitle}>2. Information We Collect</h2>
        <p className="m-0 font-semibold">a) Account Information</p>
        <p className="m-0 mt-2">We collect basic account details, including:</p>
        <ul className="m-0 mt-2 list-disc pl-5">
          <li>Name</li>
          <li>Email address</li>
          <li>Optional home address (for route planning defaults)</li>
        </ul>
        <p className="m-0 mt-3 font-semibold">b) Client Visit Information</p>
        <p className="m-0 mt-2">Users may enter client-related information, including:</p>
        <ul className="m-0 mt-2 list-disc pl-5">
          <li>Name</li>
          <li>Address</li>
          <li>Visit time windows</li>
          <li>Scheduling and route planning details</li>
        </ul>
        <p className="m-0 mt-2">
          This information is used solely to support care planning workflows.
        </p>
        <p className="m-0 mt-3 font-semibold">c) Technical and Usage Data</p>
        <p className="m-0 mt-2">We may collect limited technical data such as:</p>
        <ul className="m-0 mt-2 list-disc pl-5">
          <li>IP address</li>
          <li>Device and browser type</li>
          <li>Access timestamps and activity logs</li>
        </ul>
        <p className="m-0 mt-2">This information is used for system security and reliability.</p>
        <p className="m-0 mt-3 font-semibold">d) Security and Audit Events</p>
        <p className="m-0 mt-2">We record security and audit events such as:</p>
        <ul className="m-0 mt-2 list-disc pl-5">
          <li>Auth/session activity (login, logout, session validation)</li>
          <li>Client record access and write actions</li>
          <li>Route optimization and dashboard access events</li>
        </ul>
        <p className="m-0 mt-2">
          Audit metadata is limited to IDs, counts, timestamps, and request context. We avoid
          storing client names and addresses in audit payloads.
        </p>
      </section>

      <section>
        <h2 className={responsiveStyles.legalSectionTitle}>3. How We Use Information</h2>
        <p className="m-0">We use collected information to:</p>
        <ul className="m-0 mt-2 list-disc pl-5">
          <li>Provide route planning and scheduling functionality</li>
          <li>Support nursing and operational workflows</li>
          <li>Authenticate users and secure access</li>
          <li>Monitor system performance and prevent misuse</li>
          <li>Maintain audit logs for security and accountability</li>
        </ul>
        <p className="m-0">
          We do <strong>not</strong> sell or use personal data for advertising or marketing.
        </p>
      </section>

      <section>
        <h2 className={responsiveStyles.legalSectionTitle}>4. Data Storage and Security</h2>
        <p className="m-0">We implement reasonable safeguards to protect your data, including:</p>
        <ul className="m-0 mt-2 list-disc pl-5">
          <li>Encrypted data transmission (HTTPS/TLS)</li>
          <li>Secure server-side data storage</li>
          <li>Authentication using secure, HttpOnly session cookies</li>
          <li>Role-based access control (users can only access their own data)</li>
          <li>Audit logging of system activity and access</li>
        </ul>
        <p className="m-0 mt-2">
          We do <strong>not store client data in browser storage</strong> such as localStorage or
          sessionStorage. Authentication is managed through secure server-side sessions with
          HttpOnly cookies.
        </p>
      </section>

      <section>
        <h2 className={responsiveStyles.legalSectionTitle}>5. Data Retention</h2>
        <p className="m-0">We retain data only as long as necessary to:</p>
        <ul className="m-0 mt-2 list-disc pl-5">
          <li>Provide services to users</li>
          <li>Support operational workflows</li>
          <li>Meet applicable legal or professional requirements</li>
        </ul>
        <p className="m-0">
          Client data may be retained in accordance with healthcare record-keeping expectations (for
          example, up to 10 years, depending on applicable regulations and user obligations).
        </p>
        <p className="m-0 mt-2">
          Archived or inactive records may be retained securely and are not actively used. Client
          deletion in the app is archive-style (inactive), not immediate hard deletion.
        </p>
      </section>

      <section>
        <h2 className={responsiveStyles.legalSectionTitle}>6. Data Sharing</h2>
        <p className="m-0">We do not sell personal data.</p>
        <p className="m-0 mt-2">
          We may use trusted third-party service providers to support the application, including:
        </p>
        <ul className="m-0 mt-2 list-disc pl-5">
          <li>Cloud hosting providers</li>
          <li>Mapping and geolocation services (e.g., Google Maps APIs)</li>
        </ul>
        <p className="m-0 mt-2">
          These providers process data only as required to deliver their services.
        </p>
      </section>

      <section>
        <h2 className={responsiveStyles.legalSectionTitle}>7. User Responsibilities</h2>
        <p className="m-0">Users are responsible for:</p>
        <ul className="m-0 mt-2 list-disc pl-5">
          <li>Ensuring they have appropriate authority to collect and enter client information</li>
          <li>Maintaining the confidentiality of their login credentials</li>
          <li>
            Using the application in compliance with applicable privacy laws and professional
            standards
          </li>
        </ul>
      </section>

      <section>
        <h2 className={responsiveStyles.legalSectionTitle}>8. Your Rights</h2>
        <p className="m-0">You may request to:</p>
        <ul className="m-0 mt-2 list-disc pl-5">
          <li>Access your personal data</li>
          <li>Correct inaccurate information</li>
          <li>Request deletion of your data (where applicable)</li>
        </ul>
        <p className="m-0 mt-2">Requests can be made using the contact information below.</p>
      </section>

      <section>
        <h2 className={responsiveStyles.legalSectionTitle}>9. Security Incidents</h2>
        <p className="m-0">In the event of a data breach or unauthorized access, we will:</p>
        <ul className="m-0 mt-2 list-disc pl-5">
          <li>Investigate and contain the issue</li>
          <li>Notify affected users where appropriate</li>
          <li>Take corrective action to prevent recurrence</li>
        </ul>
      </section>

      <section>
        <h2 className={responsiveStyles.legalSectionTitle}>10. Jurisdiction</h2>
        <p className="m-0">
          Routefy is intended for use in Canada. Data handling practices are designed to align with
          applicable Canadian privacy laws, including Ontario&apos;s Personal Health Information
          Protection Act (PHIPA), where applicable.
        </p>
      </section>

      <section>
        <h2 className={responsiveStyles.legalSectionTitle}>11. Contact</h2>
        <p className="m-0">For privacy-related questions or requests, please contact:</p>
        <p className="m-0 mt-2 font-semibold">Routefy Privacy Contact</p>
        <p className="m-0 mt-2">
          <a href={SUPPORT_EMAIL_MAILTO} className={responsiveStyles.legalLink}>
            {SUPPORT_EMAIL}
          </a>
        </p>
      </section>

      <section>
        <h2 className={responsiveStyles.legalSectionTitle}>12. Changes to This Policy</h2>
        <p className="m-0">
          We may update this Privacy Policy from time to time. Updates will be reflected by the
          &ldquo;Last updated&rdquo; date above.
        </p>
      </section>
    </LegalPageLayout>
  );
}
