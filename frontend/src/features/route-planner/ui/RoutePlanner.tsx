import { useState } from "react";
import { useLocation } from "react-router-dom";
import { responsiveStyles } from "../../../components/responsiveStyles";
import type { WeeklyWorkingHours } from "../../../../../shared/contracts";
import { PatientFormModal } from "../../patients/ui/PatientFormModal";
import { useRoutePlannerController } from "../hooks/useRoutePlannerController";
import { TripSetupSection } from "./TripSetupSection";
import { PatientSelectorSection } from "./PatientSelectorSection";
import { RouteResultSection } from "./RouteResultSection";

type RoutePlannerProps = {
  nurseHomeAddress?: string | null;
  nurseWorkingHours?: WeeklyWorkingHours | null;
  nurseBreakGapThresholdMinutes?: number | null;
  onOpenAccountSettings?: () => void;
  optimizationObjective?: "time" | "distance";
};

function RoutePlanner({
  nurseHomeAddress = null,
  nurseWorkingHours,
  nurseBreakGapThresholdMinutes,
  onOpenAccountSettings,
  optimizationObjective = "distance",
}: RoutePlannerProps) {
  const location = useLocation();
  const locationState = location.state as {
    autoOptimizeToday?: boolean;
    savedRouteRunId?: string;
    planningDate?: string;
  } | null;
  const autoOptimizeToday = locationState?.autoOptimizeToday === true;
  const savedRouteRunId = locationState?.savedRouteRunId ?? null;
  const savedRouteRunPlanningDate = locationState?.planningDate ?? null;
  const [showSchedulingNotice, setShowSchedulingNotice] = useState(false);
  const {
    handleSubmit,
    isMobileViewport,
    tripSetupSectionProps,
    patientSelectorSectionProps,
    routeResultSectionProps,
    patientFormModalProps,
  } = useRoutePlannerController({
    nurseHomeAddress,
    nurseWorkingHours,
    nurseBreakGapThresholdMinutes,
    onOpenAccountSettings,
    optimizationObjective,
    autoOptimizeToday,
    savedRouteRunId,
    savedRouteRunPlanningDate,
  });

  return (
    <main className={responsiveStyles.page}>
      <section className={responsiveStyles.section}>
        <div className={responsiveStyles.sectionHeader}>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
            <h1 className={responsiveStyles.pageTitle}>Smart Route Planner</h1>
          </div>
          <div className="flex items-center gap-2">
            <p className={responsiveStyles.cardDescription}>
              {isMobileViewport
                ? "Set start, end, and client addresses. Routefy prioritizes time-window feasibility first, then distance."
                : "Choose a start, an end, and the clients to visit. We'll order the stops to meet time windows first, then cut driving, finishing at your end point."}
            </p>
            <button
              type="button"
              aria-label="Show scheduling notice"
              aria-expanded={showSchedulingNotice}
              onClick={() => setShowSchedulingNotice((current) => !current)}
              className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-blue-300 text-xs font-semibold text-blue-600 transition hover:bg-blue-50 dark:border-blue-700 dark:text-blue-300 dark:hover:bg-blue-950/30"
            >
              i
            </button>
          </div>
        </div>

        {showSchedulingNotice && (
          <div className="mb-4 rounded-xl border border-blue-100 bg-blue-50/70 px-3 py-2 text-sm text-blue-900 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-200">
            <p className="m-0 font-medium">Scheduling Notice</p>
            <p className="m-0 mt-1">
              Route plans are generated to assist with scheduling. Always review and confirm visit
              timing and feasibility before use.
            </p>
          </div>
        )}

        <form className={responsiveStyles.form} onSubmit={handleSubmit}>
          <TripSetupSection {...tripSetupSectionProps} />

          <div className="mt-2">
            <PatientSelectorSection {...patientSelectorSectionProps} />
          </div>

          <RouteResultSection {...routeResultSectionProps} />
        </form>
      </section>

      <PatientFormModal {...patientFormModalProps} />
    </main>
  );
}

export default RoutePlanner;
