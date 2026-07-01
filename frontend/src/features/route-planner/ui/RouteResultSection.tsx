import { useEffect, useState } from "react";
import { responsiveStyles } from "../../../components/responsiveStyles";
import { OptimizedRouteResult } from "./OptimizedRouteResult";
import type { OptimizeRouteResponse, OrderedStop } from "../types";
import type { RouteAdvisorResponse } from "../../../../../shared/contracts";

// Honest, generic phases for the v3 optimize (geocode → distance matrix →
// ordering). Kept vague enough not to imply real determinate progress.
const OPTIMIZE_STATUS_MESSAGES = [
  "Calculating distances between stops…",
  "Ordering stops to hit time windows…",
  "Trimming total driving time…",
  "Finalizing your route…",
];

const SyncIcon = () => (
  <svg
    width="15"
    height="15"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
    <path d="M3 3v5h5" />
    <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
    <path d="M21 21v-5h-5" />
  </svg>
);

type RouteResultSectionProps = {
  isMobileViewport: boolean;
  hasValidTripAddresses: boolean;
  destinationCount: number;
  selectedDestinationsCount: number;
  resolvedEndAddress: string;
  isLoading: boolean;
  canOptimize: boolean;
  result: OptimizeRouteResponse | null;
  hasChangedSinceLastOptimize: boolean;
  showOptimizeSuccess: boolean;
  showOptimizeFlash: boolean;
  optimizeEndpointHint?: string;
  localValidationError: string;
  optimizeError: string;
  orderedStops: OrderedStop[];
  routeLegs: OptimizeRouteResponse["routeLegs"];
  isManualOrderStale: boolean;
  unscheduledResubmitCount: number;
  onMoveStop: (stopId: string, direction: "up" | "down") => void;
  canMoveStop: (stopId: string, direction: "up" | "down") => boolean;
  onResetManualOrder: () => void;
  onRecalculateManualOrder: () => Promise<void>;
  isRecalculatingManualOrder: boolean;
  conflictWarningsDismissed: boolean;
  onDismissConflictWarnings: () => void;
  latenessWarningsDismissed: boolean;
  onDismissLatenessWarnings: () => void;
  expandedResultTaskIds: Record<string, boolean>;
  onToggleResultTask: (taskId: string) => void;
  expandedResultEndingStopIds: Record<string, boolean>;
  onToggleResultEndingStop: (stopId: string) => void;
  normalizedHomeAddress: string;
  breakGapThresholdMinutes?: number;
  workStart?: string;
  workEnd?: string;
  lunchStartTime?: string;
  lunchDurationMinutes?: number;
  planningDate: string;
  advice?: RouteAdvisorResponse | null;
  isLoadingAdvice?: boolean;
  adviceError?: string;
  adviceUnavailable?: boolean;
  onRequestAdvice?: () => void;
};

const OptimizedRouteSkeleton = () => {
  // Indeterminate "trickle" that eases toward ~90%: the real request resolves
  // and unmounts this before it completes, so it always reads as in-progress.
  const [progress, setProgress] = useState(8);
  useEffect(() => {
    const id = window.setInterval(() => {
      setProgress((current) => (current >= 90 ? 90 : current + Math.max(1, (90 - current) * 0.12)));
    }, 400);
    return () => window.clearInterval(id);
  }, []);

  const message =
    progress < 30
      ? OPTIMIZE_STATUS_MESSAGES[0]
      : progress < 55
        ? OPTIMIZE_STATUS_MESSAGES[1]
        : progress < 80
          ? OPTIMIZE_STATUS_MESSAGES[2]
          : OPTIMIZE_STATUS_MESSAGES[3];

  return (
    <section
      className={responsiveStyles.routeSkeletonSection}
      aria-label="Optimizing route"
      aria-busy="true"
      data-testid="optimized-route-skeleton"
    >
      <div className={responsiveStyles.routeSkeletonDispatch}>
        <div>
          <div className={responsiveStyles.routeSkeletonStatusRow}>
            <span className={responsiveStyles.routeSkeletonSpinner}>
              <SyncIcon />
            </span>
            <span className={responsiveStyles.routeSkeletonStatusText} aria-live="polite">
              {message}
            </span>
          </div>
          <div className={responsiveStyles.routeSkeletonProgressTrack}>
            <div
              className={responsiveStyles.routeSkeletonProgressBar}
              style={{ width: `${Math.round(progress)}%` }}
            />
          </div>
        </div>
        <div className={responsiveStyles.routeSkeletonHeader}>
          <div
            className={`${responsiveStyles.routeSkeletonPulse} ${responsiveStyles.routeSkeletonTitle}`}
          />
          <div
            className={`${responsiveStyles.routeSkeletonPulse} ${responsiveStyles.routeSkeletonHeading}`}
          />
          <div
            className={`${responsiveStyles.routeSkeletonPulse} ${responsiveStyles.routeSkeletonBody}`}
          />
          <div
            className={`${responsiveStyles.routeSkeletonPulse} ${responsiveStyles.routeSkeletonBodyShort}`}
          />
        </div>
        <div
          className={`${responsiveStyles.routeSkeletonPulse} ${responsiveStyles.routeSkeletonWarning}`}
        />
        <div className={responsiveStyles.routeSkeletonStatsGrid}>
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={`route-stat-skeleton-${index}`}
              className={`${responsiveStyles.routeSkeletonPulse} ${responsiveStyles.routeSkeletonStat}`}
            />
          ))}
        </div>
      </div>

      <div className={responsiveStyles.routeSkeletonTimelineMap}>
        <section className={responsiveStyles.routeSkeletonCard}>
          <div className={responsiveStyles.routeSkeletonSplitHeader}>
            <div className={responsiveStyles.routeSkeletonCardHeader}>
              <div
                className={`${responsiveStyles.routeSkeletonPulse} ${responsiveStyles.routeSkeletonTitle}`}
              />
              <div
                className={`${responsiveStyles.routeSkeletonPulse} ${responsiveStyles.routeSkeletonTimelineHeader}`}
              />
            </div>
            <div
              className={`${responsiveStyles.routeSkeletonPulse} ${responsiveStyles.routeSkeletonTimelineAction}`}
            />
          </div>
          <div className={responsiveStyles.routeSkeletonTimelineList}>
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={`route-timeline-skeleton-${index}`}
                className={`${responsiveStyles.routeSkeletonPulse} ${responsiveStyles.routeSkeletonTimelineItem}`}
              />
            ))}
          </div>
        </section>

        <section className={responsiveStyles.routeSkeletonCard}>
          <div className={responsiveStyles.routeSkeletonCardHeader}>
            <div
              className={`${responsiveStyles.routeSkeletonPulse} ${responsiveStyles.routeSkeletonTitle}`}
            />
            <div
              className={`${responsiveStyles.routeSkeletonPulse} ${responsiveStyles.routeSkeletonTimelineHeader}`}
            />
          </div>
          <div className={responsiveStyles.routeSkeletonMapStack}>
            <div
              className={`${responsiveStyles.routeSkeletonPulse} ${responsiveStyles.routeSkeletonMapAction}`}
            />
            <div
              className={`${responsiveStyles.routeSkeletonPulse} ${responsiveStyles.routeSkeletonMapNote}`}
            />
            <div
              className={`${responsiveStyles.routeSkeletonPulse} ${responsiveStyles.routeSkeletonMapCanvas}`}
            />
          </div>
        </section>
      </div>
    </section>
  );
};

export const RouteResultSection = ({
  isMobileViewport,
  hasValidTripAddresses,
  selectedDestinationsCount,
  isLoading,
  canOptimize,
  result,
  hasChangedSinceLastOptimize,
  showOptimizeSuccess,
  showOptimizeFlash,
  optimizeEndpointHint,
  localValidationError,
  optimizeError,
  orderedStops,
  routeLegs,
  isManualOrderStale,
  unscheduledResubmitCount,
  onMoveStop,
  canMoveStop,
  onResetManualOrder,
  onRecalculateManualOrder,
  isRecalculatingManualOrder,
  conflictWarningsDismissed,
  onDismissConflictWarnings,
  latenessWarningsDismissed,
  onDismissLatenessWarnings,
  expandedResultTaskIds,
  onToggleResultTask,
  expandedResultEndingStopIds,
  onToggleResultEndingStop,
  normalizedHomeAddress,
  breakGapThresholdMinutes,
  workStart,
  workEnd,
  lunchStartTime,
  lunchDurationMinutes,
  planningDate,
  advice,
  isLoadingAdvice,
  adviceError,
  adviceUnavailable,
  onRequestAdvice,
}: RouteResultSectionProps) => {
  // Mobile single-column: one persistent sticky Optimize bar (no step-wizard).
  const mobileOptimizeHint = !hasValidTripAddresses
    ? "Add a starting and ending point to optimize."
    : selectedDestinationsCount === 0
      ? "Add at least one client to optimize."
      : "";

  return (
    <>
      {isMobileViewport && (
        <div className={responsiveStyles.stickyFooter}>
          {mobileOptimizeHint && (
            <p className={responsiveStyles.mobileContinueHint}>{mobileOptimizeHint}</p>
          )}
          <button
            type="submit"
            disabled={
              isLoading ||
              !canOptimize ||
              !!mobileOptimizeHint ||
              (!!result && !hasChangedSinceLastOptimize)
            }
            className={responsiveStyles.optimizeButtonLarge}
            data-loading={isLoading ? "true" : "false"}
            data-success={showOptimizeSuccess ? "true" : "false"}
          >
            {isLoading ? (
              <span className={responsiveStyles.spinnerWhite} aria-hidden="true" />
            ) : (
              <SyncIcon />
            )}
            {isLoading ? "Optimizing..." : result ? "Re-optimize Route" : "Optimize Route"}
          </button>
        </div>
      )}

      {optimizeEndpointHint && (
        <p className={responsiveStyles.formWarningBanner}>{optimizeEndpointHint}</p>
      )}

      {localValidationError && (
        <p className={responsiveStyles.formWarningBanner}>{localValidationError}</p>
      )}

      {optimizeError && <p className={responsiveStyles.formErrorBanner}>{optimizeError}</p>}

      {/* First optimize (no prior result) → skeleton. Re-optimize → keep the
          existing route visible but dimmed so context isn't lost mid-request. */}
      {isLoading && !result && <OptimizedRouteSkeleton />}

      {result && (
        <div className={responsiveStyles.routeReoptimizeWrap} aria-busy={isLoading}>
          {isLoading && (
            <div className={responsiveStyles.routeReoptimizeOverlay}>
              <span className={responsiveStyles.routeReoptimizeBadge}>
                <span className={responsiveStyles.routeSkeletonSpinner}>
                  <SyncIcon />
                </span>
                Re-optimizing…
              </span>
            </div>
          )}
          <div className={isLoading ? responsiveStyles.routeReoptimizeDimmed : undefined}>
            <OptimizedRouteResult
              result={result}
              orderedStops={orderedStops}
              routeLegs={routeLegs}
              isManualOrderStale={isManualOrderStale}
              unscheduledResubmitCount={unscheduledResubmitCount}
              onMoveStop={onMoveStop}
              canMoveStop={canMoveStop}
              onResetManualOrder={onResetManualOrder}
              onRecalculateManualOrder={onRecalculateManualOrder}
              isRecalculatingManualOrder={isRecalculatingManualOrder}
              conflictWarningsDismissed={conflictWarningsDismissed}
              onDismissConflictWarnings={onDismissConflictWarnings}
              latenessWarningsDismissed={latenessWarningsDismissed}
              onDismissLatenessWarnings={onDismissLatenessWarnings}
              expandedResultTaskIds={expandedResultTaskIds}
              onToggleResultTask={onToggleResultTask}
              expandedResultEndingStopIds={expandedResultEndingStopIds}
              onToggleResultEndingStop={onToggleResultEndingStop}
              normalizedHomeAddress={normalizedHomeAddress}
              breakGapThresholdMinutes={breakGapThresholdMinutes}
              workStart={workStart}
              workEnd={workEnd}
              lunchStartTime={lunchStartTime}
              lunchDurationMinutes={lunchDurationMinutes}
              planningDate={planningDate}
              showOptimizeFlash={showOptimizeFlash}
              advice={advice}
              isLoadingAdvice={isLoadingAdvice}
              adviceError={adviceError}
              adviceUnavailable={adviceUnavailable}
              onRequestAdvice={onRequestAdvice}
            />
          </div>
        </div>
      )}
    </>
  );
};
