import { SUPPORT_EMAIL, SUPPORT_EMAIL_MAILTO } from "../../constants/support";
import { responsiveStyles } from "../responsiveStyles";
import LegalPageLayout, { type LegalPageProps } from "./LegalPageLayout";

export default function TrademarkPage({ isModal = false }: LegalPageProps) {
  return (
    <LegalPageLayout isModal={isModal} title="Trademark" updatedAt="Last updated: March 2026">
      <section>
        <h2 className={responsiveStyles.legalSectionTitle}>Routefy Trademark</h2>
        <p className="m-0">
          &ldquo;Routefy&rdquo; is a trademark of Routefy. All rights reserved. Unauthorized use of
          the Routefy name, logo, or any associated marks is prohibited without prior written
          consent.
        </p>
      </section>

      <section>
        <h2 className={responsiveStyles.legalSectionTitle}>Rights Reservation</h2>
        <p className="m-0">
          Routefy reserves all rights with respect to its trademarks, service marks, and trade
          names. Nothing in this application grants any license to use Routefy trademarks without
          express written permission.
        </p>
      </section>

      <section>
        <h2 className={responsiveStyles.legalSectionTitle}>Contact</h2>
        <p className="m-0">
          For trademark questions, contact us at{" "}
          <a href={SUPPORT_EMAIL_MAILTO} className={responsiveStyles.legalLink}>
            {SUPPORT_EMAIL}
          </a>
          .
        </p>
      </section>
    </LegalPageLayout>
  );
}
