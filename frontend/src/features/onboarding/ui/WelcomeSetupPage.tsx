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
  if (missing.includes("displayName") || missing.includes("homeAddress")) {
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
  const [breakGapInput, setBreakGapInput] = useState(
    String(authUser?.breakGapThresholdMinutes ?? 30),
  );
  const [objectiveInput, setObjectiveInput] = useState<"time" | "distance">(
    authUser?.optimizationObjective ?? "distance",
  );
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

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

    if (!nextDisplayName) {
      setError("Display name is required.");
      return;
    }
    if (!nextHomeAddress) {
      setError("Home address is required.");
      return;
    }

    setError("");
    setIsSaving(true);
    try {
      const updated = await updateProfile({
        displayName: nextDisplayName,
        homeAddress: nextHomeAddress,
      });
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

        {error && (
          <p className="m-0 mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-800/60 dark:bg-rose-900/20 dark:text-rose-200">
            {error}
          </p>
        )}

        {step === "profile" && (
          <form onSubmit={handleProfileSave} className="mt-5 grid gap-4">
            <label className="grid gap-1 text-sm text-slate-700 dark:text-slate-200">
              Display name
              <input
                value={displayNameInput}
                onChange={(event) => setDisplayNameInput(event.target.value)}
                autoComplete="name"
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
              />
            </label>
            <label className="grid gap-1 text-sm text-slate-700 dark:text-slate-200">
              Home address
              <input
                value={homeAddressInput}
                onChange={(event) => setHomeAddressInput(event.target.value)}
                autoComplete="street-address"
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
              />
            </label>
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
