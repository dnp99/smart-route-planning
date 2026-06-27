import AddressAutocompleteInput from "../../../components/shared/AddressAutocompleteInput";
import { DatePicker } from "../../../components/shared/DatePicker";
import { responsiveStyles } from "../../../components/responsiveStyles";
import { useDismissOnOutside } from "../../../components/hooks/useClickOutside";
import type { AddressSuggestion } from "../types";

const splitAddressLine = (address: string) => {
  const idx = address.indexOf(", ");
  if (idx === -1) return { primary: address, secondary: "" };
  return { primary: address.slice(0, idx), secondary: address.slice(idx + 2) };
};

const TargetIcon = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <circle cx="12" cy="12" r="7" />
    <line x1="12" y1="2" x2="12" y2="5" />
    <line x1="12" y1="19" x2="12" y2="22" />
    <line x1="2" y1="12" x2="5" y2="12" />
    <line x1="19" y1="12" x2="22" y2="12" />
    <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
  </svg>
);

const FlagIcon = () => (
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
    <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
    <line x1="4" y1="22" x2="4" y2="15" />
  </svg>
);

const PencilIcon = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
  </svg>
);

type TripSetupSectionProps = {
  isVisible: boolean;
  isMobileViewport: boolean;
  isExpanded: boolean;
  onSetExpanded: (v: boolean) => void;
  stopCount: number;
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
  planningDate: string;
  onPlanningDateChange: (date: string) => void;
};

export const TripSetupSection = ({
  isVisible,
  isMobileViewport,
  isExpanded,
  onSetExpanded,
  stopCount,
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
  planningDate,
  onPlanningDateChange,
}: TripSetupSectionProps) => {
  const bothPointsSet = startAddress.length > 0 && resolvedEndAddress.length > 0;
  // Desktop only: clicking outside (or Escape) collapses the expanded card into
  // the bookend — but only once the trip is complete, so a half-filled card
  // never auto-collapses. Mobile has no collapsed state.
  const cardRef = useDismissOnOutside<HTMLElement>(
    isVisible && isExpanded && !isMobileViewport && bothPointsSet,
    () => onSetExpanded(false),
  );

  if (!isVisible) return null;

  if (!isExpanded && !isMobileViewport) {
    const start = splitAddressLine(startAddress);
    const end = splitAddressLine(resolvedEndAddress);
    return (
      <section className={responsiveStyles.panel}>
        <div className="flex items-center justify-between gap-2">
          <p className={responsiveStyles.formGroupEyebrow}>Trip setup</p>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-500 dark:text-slate-400">
              Planning date
            </span>
            <DatePicker
              id="planningDate"
              value={planningDate}
              onChange={onPlanningDateChange}
              compact
              ariaLabel="Planning date"
            />
          </div>
        </div>

        <div className={responsiveStyles.tripBookendRow}>
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <span className={responsiveStyles.tripStartMarker}>
              <TargetIcon />
            </span>
            <div className="min-w-0">
              <p className={responsiveStyles.tripStartLabel}>Start</p>
              <p className={responsiveStyles.tripAddressPrimary}>{start.primary}</p>
              {start.secondary && (
                <p className={responsiveStyles.tripAddressSecondary}>{start.secondary}</p>
              )}
            </div>
          </div>

          <div className="hidden flex-1 items-center gap-2 lg:flex">
            <span className={responsiveStyles.tripRailDashed} />
            <span className={responsiveStyles.tripStopsPill}>
              <span aria-hidden="true">•</span>
              {stopCount} {stopCount === 1 ? "stop" : "stops"}
            </span>
            <span className={responsiveStyles.tripRailDashed} />
          </div>

          <div className="flex min-w-0 flex-1 items-center justify-end gap-3">
            <div className="min-w-0 text-right">
              <p className={responsiveStyles.tripEndLabel}>End</p>
              <p className={responsiveStyles.tripAddressPrimary}>{end.primary}</p>
              {end.secondary && (
                <p className={responsiveStyles.tripAddressSecondary}>{end.secondary}</p>
              )}
            </div>
            <span className={responsiveStyles.tripEndMarker}>
              <FlagIcon />
            </span>
            <button
              type="button"
              onClick={() => onSetExpanded(true)}
              className={responsiveStyles.tripEditButton}
            >
              <PencilIcon />
              Edit
            </button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className={responsiveStyles.panel} ref={cardRef}>
      <div className={responsiveStyles.cardHeader}>
        <div className="flex items-center justify-between gap-2">
          <h2 className={responsiveStyles.cardTitle}>Trip setup</h2>
          <div className="flex items-center gap-2">
            {!isMobileViewport && (
              <span className="text-sm font-medium text-slate-500 dark:text-slate-400">
                Planning date
              </span>
            )}
            <DatePicker
              id="planningDate"
              value={planningDate}
              onChange={onPlanningDateChange}
              compact
              ariaLabel="Planning date"
            />
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
        </div>
        <p className={responsiveStyles.cardDescription}>
          Define where you would like to start and where the route should end.
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
