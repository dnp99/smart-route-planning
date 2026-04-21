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
  if (missing.includes("displayName")) {
    return "profile";
  }
  if (missing.includes("workingHours")) {
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
      (parsedBreakGap === null || Number.isNaN(parsedBreakGap) || parsedBreakGap < 1)
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
        <p className="m-0 text-xs font-semibold uppercase tracking-[0.16em] text-blue-700 dark:text-blue-300">
          Workspace setup
        </p>
        <h1 className="m-0 mt-2 text-2xl font-semibold text-slate-900 dark:text-slate-100">
          Finish your Routefy setup
        </h1>
        <p className="m-0 mt-2 text-sm text-slate-600 dark:text-slate-300">
          We&apos;ll save your profile and scheduling defaults so route planning works right away.
        </p>

        <div className="mt-4 h-2 w-full rounded-full bg-slate-200 dark:bg-slate-700">
          <div
            className="h-2 rounded-full bg-blue-600 transition-all"
            style={{ width: `${completionPercent}%` }}
            aria-hidden="true"
          />
        </div>

        {error && step !== "profile" && (
          <p className="m-0 mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-800/60 dark:bg-rose-900/20 dark:text-rose-200">
            {error}
          </p>
        )}

        {step === "profile" && (
          <form noValidate onSubmit={handleProfileSave} className="mt-5 grid gap-4">
            <label className="grid gap-1 text-sm text-slate-700 dark:text-slate-200">
              <span>
                Display name
                <span className="ml-2 rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700 dark:bg-red-950/40 dark:text-red-300">
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
                className={[
                  "rounded-xl border px-3 py-2 text-sm outline-none transition focus:ring-2 dark:bg-slate-950",
                  profileFieldErrors.displayName
                    ? "border-red-400 text-slate-900 ring-red-500 focus:border-red-500 dark:border-red-700 dark:text-slate-100 dark:focus:border-red-500"
                    : "border-slate-300 text-slate-900 ring-blue-500 focus:border-blue-500 dark:border-slate-700 dark:text-slate-100",
                ].join(" ")}
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
              className="inline-flex w-fit items-center rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
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
                <div
                  key={key}
                  className="rounded-xl border border-slate-200 p-3 dark:border-slate-700"
                >
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
                      className="rounded-lg border border-slate-300 px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-950"
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
                      className="rounded-lg border border-slate-300 px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-950"
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
                className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-blue-300 text-xs font-semibold text-blue-600 transition hover:bg-blue-50 dark:border-blue-700 dark:text-blue-300 dark:hover:bg-blue-950/30"
              >
                i
              </button>
              <input
                type="number"
                min={1}
                value={breakGapInput}
                onChange={(event) => setBreakGapInput(event.target.value)}
                disabled={!breakGapEnabled}
                className="w-24 rounded-lg border border-slate-300 px-2 py-1 text-sm disabled:cursor-not-allowed disabled:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:disabled:bg-slate-800"
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
              className="mt-2 inline-flex w-fit items-center rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSaving ? "Saving..." : "Save and continue"}
            </button>
          </form>
        )}

        {step === "optimizationObjective" && (
          <form onSubmit={handleObjectiveSave} className="mt-5 grid gap-4">
            <fieldset className="grid gap-3 rounded-xl border border-slate-200 p-4 dark:border-slate-700">
              <legend className="px-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
                Route priority
              </legend>
              <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
                <input
                  type="radio"
                  name="optimization-objective"
                  value="time"
                  checked={objectiveInput === "time"}
                  onChange={() => setObjectiveInput("time")}
                />
                Fastest total route time
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
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
              className="inline-flex w-fit items-center rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSaving ? "Saving..." : "Complete setup"}
            </button>
          </form>
        )}
      </section>
    </main>
  );
}
