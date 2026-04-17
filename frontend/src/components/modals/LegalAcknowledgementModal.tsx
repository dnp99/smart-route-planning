import { responsiveStyles } from "../responsiveStyles";

type LegalAcknowledgementModalProps = {
  isOpen: boolean;
  isSubmitting: boolean;
  error: string;
  onAgree: () => void;
};

export default function LegalAcknowledgementModal({
  isOpen,
  isSubmitting,
  error,
  onAgree,
}: LegalAcknowledgementModalProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className={responsiveStyles.modalBackdrop}>
      <div className={`${responsiveStyles.modalSurface} max-w-xl`}>
        <h2 className="m-0 text-xl font-semibold text-slate-900 dark:text-slate-100">
          Important Notice - Client Data Use
        </h2>
        <p className="mt-3 text-sm text-slate-700 dark:text-slate-300">
          CareFlow is a workflow support tool for route planning and scheduling.
        </p>
        <p className="mt-3 text-sm font-medium text-slate-800 dark:text-slate-200">
          By using this application, you confirm that:
        </p>
        <ul className="mt-2 list-disc pl-5 text-sm text-slate-700 dark:text-slate-300">
          <li>You have appropriate authority to access and manage client information</li>
          <li>You will only enter information necessary for care planning</li>
          <li>
            You will handle all client data in accordance with applicable privacy laws and
            professional standards
          </li>
        </ul>
        <p className="mt-3 text-sm text-slate-700 dark:text-slate-300">
          CareFlow does not replace clinical judgment. You remain responsible for verifying
          schedules and delivering care safely.
        </p>
        {error && (
          <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300">
            {error}
          </p>
        )}
        <div className="mt-5 flex justify-end">
          <button
            type="button"
            disabled={isSubmitting}
            onClick={onAgree}
            className={responsiveStyles.primaryButton}
          >
            {isSubmitting ? "Saving..." : "I Agree"}
          </button>
        </div>
      </div>
    </div>
  );
}
