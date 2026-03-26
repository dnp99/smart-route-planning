import { responsiveStyles } from "../responsiveStyles";
import { OptimizedRouteResult } from "./OptimizedRouteResult";
import type { MobilePlannerStep } from "./routePlannerDraft";
import type { OptimizeRouteResponse, OrderedStop } from "../types";

type RouteResultSectionProps = {
  isMobileViewport: boolean;
  activeMobileStep: MobilePlannerStep;
  onSetActiveMobileStep: (step: MobilePlannerStep) => void;
  isReviewStepVisible: boolean;
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
  activeMobileStep,
  onSetActiveMobileStep,
  isReviewStepVisible,
  hasValidTripAddresses,
  destinationCount,
  selectedDestinationsCount,
  resolvedEndAddress,
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
  return (
    <>
      {isMobileViewport && activeMobileStep === "trip" && (
        <div className={responsiveStyles.stickyFooter}>
          {!hasValidTripAddresses && (
            <p className={responsiveStyles.mobileContinueHint}>
              Add a starting and ending point to continue.
            </p>
          )}
          <button
            type="button"
            disabled={!hasValidTripAddresses}
            onClick={() => onSetActiveMobileStep("patients")}
            className={responsiveStyles.mobileContinueButton}
          >
            Continue to Patients →
          </button>
        </div>
      )}

      {isMobileViewport && activeMobileStep === "patients" && (
        <div className={responsiveStyles.stickyFooter}>
          {selectedDestinationsCount === 0 && (
            <p className={responsiveStyles.mobileContinueHint}>
              Add at least one patient to continue.
            </p>
          )}
          <button
            type="button"
            disabled={selectedDestinationsCount === 0}
            onClick={() => onSetActiveMobileStep("review")}
            className={responsiveStyles.mobileContinueButton}
          >
            Continue to Review →
          </button>
        </div>
      )}

      {isReviewStepVisible && isMobileViewport && (
        <section className={responsiveStyles.mobileReviewCard}>
          <p className="m-0 font-semibold text-slate-900 dark:text-slate-100">Ready to optimize</p>
          <p className="m-0 text-xs text-slate-600 dark:text-slate-300">
            {destinationCount} destination(s) included
            {resolvedEndAddress.trim().length === 0 ? " • ending point missing" : ""}
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => onSetActiveMobileStep("trip")}
              className={responsiveStyles.secondaryButton}
            >
              Edit trip
            </button>
            <button
              type="button"
              onClick={() => onSetActiveMobileStep("patients")}
              className={responsiveStyles.secondaryButton}
            >
              Edit patients
            </button>
          </div>
        </section>
      )}

      {isMobileViewport && isReviewStepVisible && (
        <div className={responsiveStyles.stickyFooter}>
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
