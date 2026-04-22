import { SUPPORT_EMAIL, SUPPORT_EMAIL_MAILTO } from "../../constants/support";
import { responsiveStyles } from "../responsiveStyles";
import LegalPageLayout, { type LegalPageProps } from "./LegalPageLayout";

export default function TermsPage({ isModal = false }: LegalPageProps) {
  return (
    <LegalPageLayout
      isModal={isModal}
      title="Terms of Service"
      updatedAt="Last updated: April 16, 2026"
    >
        <section>
          <h2 className={responsiveStyles.legalSectionTitle}>1. Overview</h2>
          <p className="m-0">
            Routefy is a nurse-focused route planning and client management tool designed to support
            scheduling and operational workflows.
          </p>
          <p className="m-0 mt-2">
            By accessing or using Routefy, you agree to these Terms of Service.
          </p>
        </section>

        <section>
          <h2 className={responsiveStyles.legalSectionTitle}>
            2. Eligibility
          </h2>
          <p className="m-0">
            You must be at least 18 years old and authorized to use the system in a professional
            capacity.
          </p>
          <p className="m-0 mt-2">By using Routefy, you represent that:</p>
          <ul className="m-0 mt-2 list-disc pl-5">
            <li>You are using the service for legitimate professional purposes</li>
            <li>You have authority to manage and enter client-related information</li>
          </ul>
        </section>

        <section>
          <h2 className={responsiveStyles.legalSectionTitle}>
            3. Use of the Service
          </h2>
          <p className="m-0">
            You agree to use Routefy only for lawful purposes and in accordance with these terms.
          </p>
          <p className="m-0 mt-2">You must not:</p>
          <ul className="m-0 mt-2 list-disc pl-5">
            <li>Access or use data that does not belong to you</li>
            <li>Attempt to bypass security or authentication mechanisms</li>
            <li>Use the system to store or transmit unlawful or harmful content</li>
          </ul>
          <p className="m-0 mt-2">
            Routefy is intended for operational support only and should not be used as a substitute
            for professional judgment.
          </p>
        </section>

        <section>
          <h2 className={responsiveStyles.legalSectionTitle}>
            4. User Accounts
          </h2>
          <p className="m-0">You are responsible for:</p>
          <ul className="m-0 mt-2 list-disc pl-5">
            <li>Maintaining the confidentiality of your login credentials</li>
            <li>All activity that occurs under your account</li>
          </ul>
          <p className="m-0 mt-2">
            You must notify us if you suspect unauthorized access to your account.
          </p>
          <p className="m-0 mt-2">We may suspend or terminate accounts that violate these terms.</p>
          <p className="m-0">
            Routefy uses secure session cookies for authentication. Users must not attempt to bypass
            session controls or reuse unauthorized session artifacts.
          </p>
        </section>

        <section>
          <h2 className={responsiveStyles.legalSectionTitle}>
            5. Client Data
          </h2>
          <p className="m-0">You are solely responsible for:</p>
          <ul className="m-0 mt-2 list-disc pl-5">
            <li>
              Ensuring you have appropriate consent or authority to collect and enter client
              information
            </li>
            <li>Complying with applicable privacy laws and professional obligations</li>
          </ul>
          <p className="m-0 mt-2">
            Routefy does not verify the accuracy or legality of the data entered by users.
          </p>
          <p className="m-0 mt-2">
            Client deletion operations in the product are archive-style (inactive status) to support
            operational traceability.
          </p>
        </section>

        <section>
          <h2 className={responsiveStyles.legalSectionTitle}>
            6. Data and Availability
          </h2>
          <p className="m-0">
            We aim to provide reliable service but do not guarantee uninterrupted access.
          </p>
          <p className="m-0 mt-2">Routefy may be temporarily unavailable due to:</p>
          <ul className="m-0 mt-2 list-disc pl-5">
            <li>Maintenance</li>
            <li>System updates</li>
            <li>Technical issues</li>
          </ul>
          <p className="m-0">
            We are not responsible for data loss caused by events outside our reasonable control.
          </p>
        </section>

        <section>
          <h2 className={responsiveStyles.legalSectionTitle}>
            7. Limitation of Liability
          </h2>
          <p className="m-0">Routefy is provided on an &ldquo;as-is&rdquo; basis.</p>
          <p className="m-0 mt-2">To the maximum extent permitted by law, we are not liable for:</p>
          <ul className="m-0 mt-2 list-disc pl-5">
            <li>Any indirect, incidental, or consequential damages</li>
            <li>Loss of data, business, or operational disruption</li>
            <li>Decisions made based on route planning or scheduling outputs</li>
          </ul>
          <p className="m-0 mt-2">
            Users remain responsible for verifying schedules and ensuring safe and appropriate care
            delivery.
          </p>
        </section>

        <section>
          <h2 className={responsiveStyles.legalSectionTitle}>
            8. Intellectual Property
          </h2>
          <p className="m-0">
            All rights to the Routefy application, including software, design, and branding, are
            owned by Routefy.
          </p>
          <p className="m-0 mt-2">You may not:</p>
          <ul className="m-0 mt-2 list-disc pl-5">
            <li>Copy, modify, or distribute the software</li>
            <li>Reverse engineer or attempt to extract source code</li>
          </ul>
        </section>

        <section>
          <h2 className={responsiveStyles.legalSectionTitle}>
            9. Termination
          </h2>
          <p className="m-0">We may suspend or terminate access if:</p>
          <ul className="m-0 mt-2 list-disc pl-5">
            <li>These terms are violated</li>
            <li>The service is misused</li>
            <li>Required for security or legal reasons</li>
          </ul>
          <p className="m-0 mt-2">You may stop using the service at any time.</p>
        </section>

        <section>
          <h2 className={responsiveStyles.legalSectionTitle}>
            10. Changes to the Service
          </h2>
          <p className="m-0">
            We may modify or update Routefy at any time, including features and functionality.
          </p>
          <p className="m-0 mt-2">
            We may also update these Terms. Continued use of the service means you accept the
            updated Terms.
          </p>
        </section>

        <section>
          <h2 className={responsiveStyles.legalSectionTitle}>
            11. Governing Law
          </h2>
          <p className="m-0">
            These Terms are governed by the laws of the Province of Ontario and the laws of Canada
            applicable therein.
          </p>
        </section>

        <section>
          <h2 className={responsiveStyles.legalSectionTitle}>12. Contact</h2>
          <p className="m-0">For questions about these Terms, contact:</p>
          <p className="m-0 mt-2 font-semibold">Routefy Support</p>
          <p className="m-0 mt-2">
            <a
              href={SUPPORT_EMAIL_MAILTO}
              className={responsiveStyles.legalLink}
            >
              {SUPPORT_EMAIL}
            </a>
          </p>
        </section>
    </LegalPageLayout>
  );
}
