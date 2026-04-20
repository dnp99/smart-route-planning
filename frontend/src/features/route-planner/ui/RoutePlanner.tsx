import { useState } from "react";
import { responsiveStyles } from "../responsiveStyles";
import type { WeeklyWorkingHours } from "../../../../../shared/contracts";
import { PatientFormModal } from "../modals/PatientFormModal";
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
  const [showSchedulingNotice, setShowSchedulingNotice] = useState(false);
  const {
    handleSubmit,
    isMobileViewport,
    activeMobileStep,
    setActiveMobileStep,
    mobileSteps,
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
              Enter your starting point, ending point, and destination addresses. The planner
              prioritizes time-window feasibility first, then distance, with the ending point as the
              final stop.
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
          {isMobileViewport && (
            <nav aria-label="Route planner steps" className={responsiveStyles.mobileStepNav}>
              {mobileSteps.map((step) => {
                const isActive = activeMobileStep === step.key;
                return (
                  <button
                    key={step.key}
                    type="button"
                    aria-pressed={isActive}
                    onClick={() => setActiveMobileStep(step.key)}
                    className={`${responsiveStyles.mobileStepButton} ${isActive ? responsiveStyles.mobileStepButtonActive : responsiveStyles.mobileStepButtonInactive}`}
                  >
                    <span className="flex items-center justify-center gap-1">
                      {step.isComplete && !isActive ? (
                        <svg
                          width="11"
                          height="11"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="3"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                          className={responsiveStyles.stepCheckIcon}
                        >
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      ) : (
                        <span className={responsiveStyles.stepNumberBadge}>{step.stepNumber}</span>
                      )}
                      {step.label}
                    </span>
                  </button>
                );
              })}
            </nav>
          )}

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
