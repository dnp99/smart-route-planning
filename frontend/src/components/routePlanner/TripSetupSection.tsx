import AddressAutocompleteInput from "../AddressAutocompleteInput";
import { responsiveStyles } from "../responsiveStyles";
import type { AddressSuggestion } from "../types";

type TripSetupSectionProps = {
  isVisible: boolean;
  isMobileViewport: boolean;
  isExpanded: boolean;
  onSetExpanded: (v: boolean) => void;
  startAddress: string;
  resolvedEndAddress: string;
  manualEndAddress: string;
  startFieldError?: string;
  endFieldError?: string;
  isHomeAddressMissing: boolean;
  onStartAddressChange: (value: string) => void;
  onStartAddressPick: (suggestion: AddressSuggestion) => void;
  onEndAddressChange: (value: string) => void;
  onEndAddressPick: (suggestion: AddressSuggestion) => void;
  onStartBlur: () => void;
  onEndBlur: () => void;
  onOpenAccountSettings?: () => void;
};

export const TripSetupSection = ({
  isVisible,
  isMobileViewport,
  isExpanded,
  onSetExpanded,
  startAddress,
  resolvedEndAddress,
  manualEndAddress,
  startFieldError,
  endFieldError,
  isHomeAddressMissing,
  onStartAddressChange,
  onStartAddressPick,
  onEndAddressChange,
  onEndAddressPick,
  onStartBlur,
  onEndBlur,
  onOpenAccountSettings,
}: TripSetupSectionProps) => {
  if (!isVisible) return null;

  if (!isExpanded && !isMobileViewport) {
    return (
      <section className={responsiveStyles.panel}>
        <div className="flex items-start justify-between gap-3 sm:items-center">
          <p className="m-0 min-w-0 flex-1 text-sm text-slate-700 dark:text-slate-300">
            <span className="break-words">
              {startAddress} <span className="text-slate-400">→</span> {resolvedEndAddress}
            </span>{" "}
            —{" "}
            <button
              type="button"
              onClick={() => onSetExpanded(true)}
              className={responsiveStyles.inlineEditLink}
            >
              Edit
            </button>
          </p>
          <button
            type="button"
            aria-label="Expand trip setup"
            onClick={() => onSetExpanded(true)}
            className={responsiveStyles.panelChevronButton}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className={responsiveStyles.panel}>
      <div className={responsiveStyles.cardHeader}>
        <div className="flex items-center justify-between gap-2">
          <h2 className={responsiveStyles.cardTitle}>Trip setup</h2>
          {!isMobileViewport && startAddress.length > 0 && resolvedEndAddress.length > 0 && (
            <button
              type="button"
              aria-label="Collapse trip setup"
              onClick={() => onSetExpanded(false)}
              className={responsiveStyles.panelChevronButton}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <polyline points="18 15 12 9 6 15" />
              </svg>
            </button>
          )}
        </div>
        <p className={responsiveStyles.cardDescription}>
          Define where the nurse starts and how the route should end.
        </p>
      </div>

      {isHomeAddressMissing && (
        <div className={responsiveStyles.warningBannerAmber}>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className={responsiveStyles.warningBannerTitle}>Home address not set</p>
              <p className={responsiveStyles.warningBannerDescription}>
                Set your home address in Account settings to auto-fill starting and ending points.
                You can still enter addresses manually.
              </p>
            </div>
            {onOpenAccountSettings && (
              <button
                type="button"
                onClick={onOpenAccountSettings}
                className={responsiveStyles.warningBannerButton}
              >
                Open account settings
              </button>
            )}
          </div>
        </div>
      )}

      <div className={responsiveStyles.patientSelectionGrid}>
        <AddressAutocompleteInput
          id="startAddress"
          label="Starting point"
          placeholder="e.g. 1 Apple Park Way, Cupertino"
          value={startAddress}
          onChange={onStartAddressChange}
          onSuggestionPick={onStartAddressPick}
          onBlur={onStartBlur}
          helperText="Type at least 3 characters to see suggestions."
          errorText={startFieldError}
          required
        />
        <AddressAutocompleteInput
          id="endAddress"
          label="Ending point"
          placeholder="e.g. Pearson International Airport"
          value={manualEndAddress}
          onChange={onEndAddressChange}
          onSuggestionPick={onEndAddressPick}
          onBlur={onEndBlur}
          helperText="Type at least 3 characters to see suggestions."
          errorText={endFieldError}
          required
        />
      </div>
    </section>
  );
};
