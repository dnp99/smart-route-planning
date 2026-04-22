import { Link } from "react-router-dom";
import { responsiveStyles } from "../responsiveStyles";
import type { ReactNode } from "react";

export type LegalPageProps = {
  isModal?: boolean;
};

type LegalPageLayoutProps = {
  title: string;
  updatedAt: string;
  isModal?: boolean;
  children: ReactNode;
};

export default function LegalPageLayout({
  title,
  updatedAt,
  isModal = false,
  children,
}: LegalPageLayoutProps) {
  return (
    <main className={`${isModal ? "mt-3" : "mt-4"} ${responsiveStyles.legalPageContainer}`}>
      <h1 className={responsiveStyles.legalPageTitle}>{title}</h1>
      <p className={responsiveStyles.legalPageUpdatedAt}>{updatedAt}</p>

      <div className={responsiveStyles.legalPageContent}>{children}</div>

      {!isModal && (
        <div className={responsiveStyles.legalFooter}>
          <Link to="/" className={responsiveStyles.legalBackLink}>
            &larr; Back to app
          </Link>
        </div>
      )}
    </main>
  );
}
