import { responsiveStyles } from "../../../components/responsiveStyles";
import { OptimizedRouteResult } from "./OptimizedRouteResult";
import type { OptimizeRouteResponse, OrderedStop } from "../types";

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
};

const OptimizedRouteSkeleton = () => (
  <section
    className={responsiveStyles.routeSkeletonSection}
    aria-label="Optimizing route"
    data-testid="optimized-route-skeleton"
  >
    <div className={responsiveStyles.routeSkeletonDispatch}>
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
            disabled={isLoading || !canOptimize || (!!result && !hasChangedSinceLastOptimize)}
            className={responsiveStyles.optimizeButtonLarge}
            data-loading={isLoading ? "true" : "false"}
            data-success={showOptimizeSuccess ? "true" : "false"}
          >
            {isLoading && <span className={responsiveStyles.spinnerWhite} aria-hidden="true" />}
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

      {isLoading && <OptimizedRouteSkeleton />}

      {result && !isLoading && (
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
        />
      )}
    </>
  );
};
