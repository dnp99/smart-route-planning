import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { AuthUser, WeeklyWorkingHours } from "../../../../../shared/contracts";
import {
  updateOptimizationObjective,
  updateProfile,
  updateWorkingHours,
} from "../../../components/auth/authService";
import { setStoredAuthUser } from "../../../components/auth/authSession";
import { responsiveStyles } from "../../../components/responsiveStyles";
import AddressAutocompleteInput from "../../../components/shared/AddressAutocompleteInput";

const DAYS = [
  { key: "monday" as const, label: "Mon" },
  { key: "tuesday" as const, label: "Tue" },
  { key: "wednesday" as const, label: "Wed" },
  { key: "thursday" as const, label: "Thu" },
  { key: "friday" as const, label: "Fri" },
  { key: "saturday" as const, label: "Sat" },
  { key: "sunday" as const, label: "Sun" },
];

type DayKey = (typeof DAYS)[number]["key"];
type SetupStep = "profile" | "workingHours" | "optimizationObjective";

const buildDefaultSchedule = (
  source: WeeklyWorkingHours | null | undefined,
): WeeklyWorkingHours => {
  const schedule: WeeklyWorkingHours = {};

  for (const { key } of DAYS) {
    schedule[key] = {
      enabled: source?.[key]?.enabled ?? (key !== "saturday" && key !== "sunday"),
      start: source?.[key]?.start ?? "09:00",
      end: source?.[key]?.end ?? "17:00",
      lunchBreak: {
        enabled: source?.[key]?.lunchBreak?.enabled ?? false,
        startTime: source?.[key]?.lunchBreak?.startTime ?? "12:00",
        durationMinutes: source?.[key]?.lunchBreak?.durationMinutes ?? 30,
      },
    };
  }

  return schedule;
};

const resolveNextStep = (user: AuthUser | null): SetupStep => {
  const missing = user?.setupMissing ?? [];
  if (missing.indexOf("displayName") >= 0) {
    return "profile";
  }
  if (missing.indexOf("workingHours") >= 0) {
    return "workingHours";
  }
  return "optimizationObjective";
};

type WelcomeSetupPageProps = {
  authUser: AuthUser | null;
};

export default function WelcomeSetupPage({ authUser }: WelcomeSetupPageProps) {
  const navigate = useNavigate();
  const [step, setStep] = useState<SetupStep>(() => resolveNextStep(authUser));
  const [displayNameInput, setDisplayNameInput] = useState(authUser?.displayName ?? "");
  const [homeAddressInput, setHomeAddressInput] = useState(authUser?.homeAddress ?? "");
  const [scheduleInput, setScheduleInput] = useState<WeeklyWorkingHours>(() =>
    buildDefaultSchedule(authUser?.workingHours),
  );
  const [breakGapEnabled, setBreakGapEnabled] = useState(
    authUser?.breakGapThresholdMinutes != null,
  );
  const [showBreakReminderInfo, setShowBreakReminderInfo] = useState(false);
  const [breakGapInput, setBreakGapInput] = useState(
    String(authUser?.breakGapThresholdMinutes ?? 30),
  );
  const [objectiveInput, setObjectiveInput] = useState<"time" | "distance">(
    authUser?.optimizationObjective ?? "distance",
  );
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [profileFieldErrors, setProfileFieldErrors] = useState<{
    displayName?: string;
  }>({});

  const completionPercent = useMemo(() => {
    if (step === "profile") return 33;
    if (step === "workingHours") return 66;
    return 100;
  }, [step]);

  const goToNextStep = (user: AuthUser | null) => {
    if (user?.isSetupComplete) {
      navigate("/home", { replace: true });
      return;
    }

    setStep(resolveNextStep(user));
  };

  const handleProfileSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextDisplayName = displayNameInput.trim();
    const nextHomeAddress = homeAddressInput.trim();
    const nextErrors: { displayName?: string } = {};

    if (!nextDisplayName) {
      nextErrors.displayName = "Display name is required.";
    }

    if (nextErrors.displayName) {
      setProfileFieldErrors(nextErrors);
      return;
    }

    setProfileFieldErrors({});
    setError("");
    setIsSaving(true);
    try {
      const updated = await updateProfile(
        nextHomeAddress.length > 0
          ? { displayName: nextDisplayName, homeAddress: nextHomeAddress }
          : { displayName: nextDisplayName },
      );
      setStoredAuthUser(updated.user);
      goToNextStep(updated.user);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save profile.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleWorkingHoursSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsedBreakGap = breakGapEnabled ? Number.parseInt(breakGapInput, 10) : null;

    if (
      breakGapEnabled &&
      (parsedBreakGap === null || isNaN(parsedBreakGap) || parsedBreakGap < 1)
    ) {
      setError("Break reminder minutes must be a positive number.");
      return;
    }

    setError("");
    setIsSaving(true);
    try {
      const updated = await updateWorkingHours(scheduleInput, parsedBreakGap);
      setStoredAuthUser(updated.user);
      goToNextStep(updated.user);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save working hours.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleObjectiveSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setError("");
    setIsSaving(true);
    try {
      const updated = await updateOptimizationObjective(objectiveInput);
      setStoredAuthUser(updated.user);
      goToNextStep(updated.user);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save route preference.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <main className={responsiveStyles.onboardingSetupViewport}>
      <section className={responsiveStyles.onboardingSetupCard}>
        <p className={responsiveStyles.onboardingSectionLabel}>
          Workspace setup
        </p>
        <h1 className={responsiveStyles.onboardingTitle}>
          Finish your Routefy setup
        </h1>
        <p className={responsiveStyles.onboardingSubtitle}>
          We&apos;ll save your profile and scheduling defaults so route planning works right away.
        </p>

        <div className={responsiveStyles.onboardingProgressTrack}>
          <div
            className={responsiveStyles.onboardingProgressFill}
            style={{ width: `${completionPercent}%` }}
            aria-hidden="true"
          />
        </div>

        {error && step !== "profile" && (
          <p className={responsiveStyles.onboardingErrorBanner}>
            {error}
          </p>
        )}

        {step === "profile" && (
          <form noValidate onSubmit={handleProfileSave} className="mt-5 grid gap-4">
            <label className={responsiveStyles.onboardingFieldLabel}>
              <span>
                Display name
                <span className={responsiveStyles.onboardingRequiredBadge}>
                  Required
                </span>
              </span>
              <input
                value={displayNameInput}
                onChange={(event) => {
                  setDisplayNameInput(event.target.value);
                  if (profileFieldErrors.displayName) {
                    setProfileFieldErrors((current) => ({
                      ...current,
                      displayName: undefined,
                    }));
                  }
                }}
                autoComplete="name"
                aria-invalid={Boolean(profileFieldErrors.displayName)}
                className={
                  profileFieldErrors.displayName
                    ? `${responsiveStyles.formInput} border-red-400 focus:border-red-500 focus:ring-red-100 dark:border-red-700 dark:focus:border-red-500`
                    : responsiveStyles.formInput
                }
              />
              {profileFieldErrors.displayName && (
                <span className="text-xs text-red-600 dark:text-red-400">
                  {profileFieldErrors.displayName}
                </span>
              )}
            </label>
            <div>
              <AddressAutocompleteInput
                id="setup-home-address"
                label="Home address"
                placeholder="Search address"
                value={homeAddressInput}
                helperText="Optional"
                onChange={setHomeAddressInput}
              />
            </div>
            <button
              type="submit"
              disabled={isSaving}
              className={responsiveStyles.onboardingPrimaryButton}
            >
              {isSaving ? "Saving..." : "Save and continue"}
            </button>
          </form>
        )}

        {step === "workingHours" && (
          <form onSubmit={handleWorkingHoursSave} className="mt-5 grid gap-3">
            {DAYS.map(({ key, label }) => {
              const day = scheduleInput[key];
              return (
                <div key={key} className={responsiveStyles.panel}>
                  <div className="flex flex-wrap items-center gap-3">
                    <label className="flex items-center gap-2 text-sm font-medium text-slate-800 dark:text-slate-100">
                      <input
                        type="checkbox"
                        checked={Boolean(day?.enabled)}
                        onChange={(event) =>
                          setScheduleInput((current) => ({
                            ...current,
                            [key]: { ...current[key], enabled: event.target.checked },
                          }))
                        }
                      />
                      {label}
                    </label>
                    <input
                      type="time"
                      value={day?.start ?? "09:00"}
                      onChange={(event) =>
                        setScheduleInput((current) => ({
                          ...current,
                          [key]: { ...current[key], start: event.target.value },
                        }))
                      }
                      className={responsiveStyles.onboardingTimeInput}
                      aria-label={`${label} start time`}
                    />
                    <span className="text-sm text-slate-500 dark:text-slate-400">to</span>
                    <input
                      type="time"
                      value={day?.end ?? "17:00"}
                      onChange={(event) =>
                        setScheduleInput((current) => ({
                          ...current,
                          [key]: { ...current[key], end: event.target.value },
                        }))
                      }
                      className={responsiveStyles.onboardingTimeInput}
                      aria-label={`${label} end time`}
                    />
                  </div>
                </div>
              );
            })}

            <div className="mt-1 flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
                <input
                  type="checkbox"
                  checked={breakGapEnabled}
                  onChange={(event) => setBreakGapEnabled(event.target.checked)}
                />
                Enable break reminders
              </label>
              <button
                type="button"
                aria-label="Show break reminder info"
                aria-expanded={showBreakReminderInfo}
                onClick={() => setShowBreakReminderInfo((current) => !current)}
                className={responsiveStyles.onboardingBreakToggleButton}
              >
                i
              </button>
              <input
                type="number"
                min={1}
                value={breakGapInput}
                onChange={(event) => setBreakGapInput(event.target.value)}
                disabled={!breakGapEnabled}
                className={responsiveStyles.onboardingBreakInput}
                aria-label="Break reminder minutes"
              />
              <span className="text-sm text-slate-500 dark:text-slate-400">minutes</span>
            </div>
            {showBreakReminderInfo && (
              <p className="m-0 rounded-xl border border-blue-100 bg-blue-50/70 px-3 py-2 text-sm text-blue-900 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-200">
                Break reminders suggest a break card when there is at least this many idle minutes
                between visits.
              </p>
            )}

            <button
              type="submit"
              disabled={isSaving}
              className={`${responsiveStyles.onboardingPrimaryButton} mt-2`}
            >
              {isSaving ? "Saving..." : "Save and continue"}
            </button>
          </form>
        )}

        {step === "optimizationObjective" && (
          <form onSubmit={handleObjectiveSave} className="mt-5 grid gap-4">
            <fieldset className={responsiveStyles.onboardingObjectiveFieldset}>
              <legend className="px-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
                Route priority
              </legend>
              <label className={responsiveStyles.onboardingRadioLabel}>
                <input
                  type="radio"
                  name="optimization-objective"
                  value="time"
                  checked={objectiveInput === "time"}
                  onChange={() => setObjectiveInput("time")}
                />
                Fastest total route time
              </label>
              <label className={responsiveStyles.onboardingRadioLabel}>
                <input
                  type="radio"
                  name="optimization-objective"
                  value="distance"
                  checked={objectiveInput === "distance"}
                  onChange={() => setObjectiveInput("distance")}
                />
                Shortest total distance
              </label>
            </fieldset>
            <button
              type="submit"
              disabled={isSaving}
              className={responsiveStyles.onboardingPrimaryButton}
            >
              {isSaving ? "Saving..." : "Complete setup"}
            </button>
          </form>
        )}
      </section>
    </main>
  );
}
