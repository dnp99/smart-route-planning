import { useEffect, useState } from "react";
import AddressAutocompleteInput from "../AddressAutocompleteInput";
import ConfirmDialog from "./ConfirmDialog";
import { responsiveStyles } from "../responsiveStyles";
import { useAccountSettings, DAYS, buildDefaultSchedule } from "../hooks/useAccountSettings";
import type { WeeklyWorkingHours } from "../../../../shared/contracts";

const MAX_HOME_ADDRESS_LENGTH = 200;
const PROFILE_MODAL_HOME_ADDRESS_ID = "account-settings-home-address";

type AuthUser = {
  displayName?: string;
  email?: string;
  homeAddress?: string;
  workingHours?: WeeklyWorkingHours | null;
  breakGapThresholdMinutes?: number | null;
  optimizationObjective?: "time" | "distance" | null;
} | null;

interface AccountSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  authUser: AuthUser;
  onHomeAddressSaved: (updatedUser: AuthUser) => void;
}

const EyeIcon = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    className={className}
  >
    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const EyeOffIcon = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    className={className}
  >
    <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
    <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
    <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
    <line x1="2" x2="22" y1="2" y2="22" />
  </svg>
);

const resolveSettingsTabClassName = (isActive: boolean) =>
  [
    "border-b-[3px] px-1 pb-3 pt-3 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50",
    isActive
      ? "border-blue-700 text-blue-700 dark:border-blue-400 dark:text-blue-300"
      : "border-transparent text-slate-600 hover:border-slate-300 hover:text-slate-800 dark:text-slate-400 dark:hover:border-slate-600 dark:hover:text-slate-200",
  ].join(" ");

export default function AccountSettingsModal({
  isOpen,
  onClose,
  authUser,
  onHomeAddressSaved,
}: AccountSettingsModalProps) {
  const [activeSettingsTab, setActiveSettingsTab] = useState<"profile" | "working-hours" | "route">(
    "profile",
  );
  const [pendingTabSwitch, setPendingTabSwitch] = useState<
    "profile" | "working-hours" | "route" | null
  >(null);
  const currentOptimizationObjective = authUser?.optimizationObjective ?? "distance";
  const [routeObjectiveInput, setRouteObjectiveInput] = useState<"time" | "distance">(
    currentOptimizationObjective,
  );
  const {
    // Home address
    homeAddressInput,
    setHomeAddressInput,
    accountSettingsError,
    setAccountSettingsError,
    accountSettingsSuccess,
    isSavingAccountSettings,
    handleAccountSettingsSubmit,
    // Password
    currentPasswordInput,
    setCurrentPasswordInput,
    newPasswordInput,
    setNewPasswordInput,
    confirmPasswordInput,
    setConfirmPasswordInput,
    passwordError,
    passwordSuccess,
    isUpdatingPassword,
    showCurrentPassword,
    setShowCurrentPassword,
    showNewPassword,
    setShowNewPassword,
    showConfirmPassword,
    setShowConfirmPassword,
    handlePasswordUpdateSubmit,
    // Schedule
    scheduleInput,
    breakGapEnabled,
    setBreakGapEnabled,
    breakGapInput,
    setBreakGapInput,
    scheduleError,
    scheduleSuccess,
    isSavingSchedule,
    handleScheduleSubmit,
    updateDay,
    updateLunch,
    // Optimization objective
    isSavingObjective,
    objectiveError,
    handleOptimizationObjectiveChange,
    // Shared
    isBusy,
    handleClose,
  } = useAccountSettings({ authUser, isOpen, onClose, onSaved: onHomeAddressSaved });
  const scheduleControlsDisabled = isBusy;

  useEffect(() => {
    if (!isOpen) return;
    setRouteObjectiveInput(currentOptimizationObjective);
  }, [isOpen, currentOptimizationObjective]);

  const handleRouteSettingsSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await handleOptimizationObjectiveChange(routeObjectiveInput);
  };

  const isProfilePasswordMode =
    currentPasswordInput.length > 0 ||
    newPasswordInput.length > 0 ||
    confirmPasswordInput.length > 0;
  const normalizedSavedHomeAddress = (authUser?.homeAddress ?? "").trim();
  const normalizedHomeAddressInput = homeAddressInput.trim();
  const hasProfileAddressChanges = normalizedHomeAddressInput !== normalizedSavedHomeAddress;

  const baselineScheduleInput = buildDefaultSchedule(authUser?.workingHours);
  const hasScheduleChanges =
    JSON.stringify(scheduleInput) !== JSON.stringify(baselineScheduleInput);
  const baselineBreakGapEnabled = authUser?.breakGapThresholdMinutes != null;
  const parsedBreakGapInput = parseInt(breakGapInput, 10);
  const nextBreakGapValue =
    breakGapEnabled && !isNaN(parsedBreakGapInput) ? parsedBreakGapInput : null;
  const hasBreakGapChanges =
    breakGapEnabled !== baselineBreakGapEnabled ||
    nextBreakGapValue !== (authUser?.breakGapThresholdMinutes ?? null);
  const hasWorkingHoursChanges = hasScheduleChanges || hasBreakGapChanges;

  const handleProfileSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    if (isProfilePasswordMode) {
      await handlePasswordUpdateSubmit(event);
      return;
    }

    await handleAccountSettingsSubmit(event);
  };

  const hasUnsavedChangesForTab = (tab: "profile" | "working-hours" | "route") => {
    if (tab === "profile") {
      return hasProfileAddressChanges || isProfilePasswordMode;
    }
    if (tab === "working-hours") {
      return hasWorkingHoursChanges;
    }
    return routeObjectiveInput !== currentOptimizationObjective;
  };

  const handleTabSwitch = (nextTab: "profile" | "working-hours" | "route") => {
    if (nextTab === activeSettingsTab || isBusy) return;
    if (hasUnsavedChangesForTab(activeSettingsTab)) {
      setPendingTabSwitch(nextTab);
      return;
    }
    setActiveSettingsTab(nextTab);
  };

  const handleConfirmTabSwitch = () => {
    if (pendingTabSwitch) {
      setActiveSettingsTab(pendingTabSwitch);
    }
    setPendingTabSwitch(null);
  };

  const handleCancelTabSwitch = () => {
    setPendingTabSwitch(null);
  };

  const activeFormId =
    activeSettingsTab === "profile"
      ? "account-settings-profile-form"
      : activeSettingsTab === "working-hours"
        ? "account-settings-working-hours-form"
        : "account-settings-route-form";

  const isActiveSaveDisabled =
    activeSettingsTab === "profile"
      ? isProfilePasswordMode
        ? isUpdatingPassword ||
          !(
            currentPasswordInput.length > 0 &&
            newPasswordInput.length > 0 &&
            confirmPasswordInput === newPasswordInput
          )
        : isSavingAccountSettings || !hasProfileAddressChanges
      : activeSettingsTab === "working-hours"
        ? scheduleControlsDisabled || !hasWorkingHoursChanges
        : isSavingObjective || routeObjectiveInput === currentOptimizationObjective;

  const saveButtonLabel =
    activeSettingsTab === "profile"
      ? isProfilePasswordMode
        ? isUpdatingPassword
          ? "Updating..."
          : "Update password"
        : isSavingAccountSettings
          ? "Saving..."
          : "Save profile"
      : activeSettingsTab === "working-hours"
        ? isSavingSchedule
          ? "Saving..."
          : "Save schedule"
        : isSavingObjective
          ? "Saving..."
          : "Save route";

  if (!isOpen) return null;

  return (
    <>
      <div
        className={responsiveStyles.modalBackdrop}
        onPointerDown={(event) => {
          if (event.target === event.currentTarget) handleClose();
        }}
      >
        <div className={`${responsiveStyles.modalSurface} flex flex-col overflow-hidden`}>
          <div className="sm:hidden -mx-4 -mt-4 mb-3 flex justify-center pb-1 pt-2.5">
            <div className="h-1.5 w-10 rounded-full bg-slate-300 dark:bg-slate-600" />
          </div>
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h2 className="m-0 text-lg font-semibold text-slate-900 dark:text-slate-100">
                Account settings
              </h2>
              <p className="m-0 mt-1 text-sm text-slate-600 dark:text-slate-300">
                Manage account profile details for route-planning defaults.
              </p>
            </div>
            <button
              type="button"
              onClick={handleClose}
              disabled={isBusy}
              aria-label="Close modal"
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-700 transition hover:border-slate-300 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <path
                  d="M2 2l10 10M12 2L2 12"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>

          <div className="mb-4 mt-2">
            <div className={responsiveStyles.tabNav}>
              <button
                type="button"
                onClick={() => handleTabSwitch("profile")}
                className={resolveSettingsTabClassName(activeSettingsTab === "profile")}
                aria-pressed={activeSettingsTab === "profile"}
              >
                Profile
              </button>
              <button
                type="button"
                onClick={() => handleTabSwitch("working-hours")}
                className={resolveSettingsTabClassName(activeSettingsTab === "working-hours")}
                aria-pressed={activeSettingsTab === "working-hours"}
              >
                Working hours
              </button>
              <button
                type="button"
                onClick={() => handleTabSwitch("route")}
                className={resolveSettingsTabClassName(activeSettingsTab === "route")}
                aria-pressed={activeSettingsTab === "route"}
              >
                Route
              </button>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto pb-4">
            <div className="min-h-[30rem]">
              {activeSettingsTab === "profile" && (
                <form
                  id="account-settings-profile-form"
                  className="grid gap-4"
                  onSubmit={handleProfileSubmit}
                >
                  <label className="grid gap-1 text-sm text-slate-700 dark:text-slate-300">
                    <span className="font-medium">Email</span>
                    <input
                      type="email"
                      value={authUser?.email ?? ""}
                      readOnly
                      disabled
                      className="w-full rounded-xl border border-slate-200 bg-slate-100 px-3 py-2.5 text-sm text-slate-600 outline-none disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 sm:px-4 sm:py-3"
                    />
                  </label>

                  <AddressAutocompleteInput
                    id={PROFILE_MODAL_HOME_ADDRESS_ID}
                    label="Home address"
                    placeholder="Pearson International Airport"
                    value={homeAddressInput}
                    onChange={(value) => {
                      setHomeAddressInput(value.slice(0, MAX_HOME_ADDRESS_LENGTH));
                      if (accountSettingsError) setAccountSettingsError("");
                    }}
                    helperText="Used to prefill default start and ending points in Route Planner."
                    disabled={isSavingAccountSettings}
                  />

                  {accountSettingsError && (
                    <p className="m-0 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/70 dark:bg-red-950/40 dark:text-red-300">
                      {accountSettingsError}
                    </p>
                  )}
                  {accountSettingsSuccess && (
                    <p className="m-0 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/40 dark:text-emerald-300">
                      {accountSettingsSuccess}
                    </p>
                  )}

                  <div className="my-1 border-t border-slate-200 dark:border-slate-800" />
                  <p className="m-0 text-sm font-semibold text-slate-900 dark:text-slate-100">
                    Security
                  </p>

                  {(["current", "new", "confirm"] as const).map((field) => {
                    const isConfirm = field === "confirm";
                    const isCurrent = field === "current";
                    const value = isCurrent
                      ? currentPasswordInput
                      : isConfirm
                        ? confirmPasswordInput
                        : newPasswordInput;
                    const show = isCurrent
                      ? showCurrentPassword
                      : isConfirm
                        ? showConfirmPassword
                        : showNewPassword;
                    const setShow = isCurrent
                      ? setShowCurrentPassword
                      : isConfirm
                        ? setShowConfirmPassword
                        : setShowNewPassword;
                    const setValue = isCurrent
                      ? (v: string) => setCurrentPasswordInput(v)
                      : isConfirm
                        ? (v: string) => setConfirmPasswordInput(v)
                        : (v: string) => setNewPasswordInput(v);
                    const label = isCurrent
                      ? "Current password"
                      : isConfirm
                        ? "Confirm new password"
                        : "New password";
                    const autoComplete = isCurrent ? "current-password" : "new-password";
                    const confirmBorderClass =
                      isConfirm && confirmPasswordInput.length > 0
                        ? confirmPasswordInput === newPasswordInput
                          ? "border-emerald-500 focus:border-emerald-500 dark:border-emerald-500"
                          : "border-red-400 focus:border-red-400 focus:ring-2 focus:ring-red-100 dark:border-red-400"
                        : "border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-slate-700";

                    return (
                      <label
                        key={field}
                        className="grid gap-1 text-sm text-slate-700 dark:text-slate-300"
                      >
                        <span className="font-medium">{label}</span>
                        <div className="relative">
                          <input
                            type={show ? "text" : "password"}
                            value={value}
                            onChange={(e) => setValue(e.target.value)}
                            autoComplete={autoComplete}
                            disabled={isUpdatingPassword}
                            className={[
                              "w-full rounded-xl border bg-white px-3 py-2.5 pr-10 text-sm text-slate-900 outline-none transition hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-slate-800 dark:text-slate-100 sm:px-4 sm:py-3",
                              isConfirm
                                ? confirmBorderClass
                                : "border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-slate-700",
                            ].join(" ")}
                          />
                          <button
                            type="button"
                            onClick={() => setShow((v) => !v)}
                            aria-label={show ? "Hide password" : "Show password"}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
                          >
                            {show ? (
                              <EyeOffIcon className="h-4 w-4" />
                            ) : (
                              <EyeIcon className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      </label>
                    );
                  })}

                  {passwordError && (
                    <p className="m-0 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/70 dark:bg-red-950/40 dark:text-red-300">
                      {passwordError}
                    </p>
                  )}
                  {passwordSuccess && (
                    <p className="m-0 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/40 dark:text-emerald-300">
                      {passwordSuccess}
                    </p>
                  )}
                </form>
              )}

              {activeSettingsTab === "working-hours" && (
                <form
                  id="account-settings-working-hours-form"
                  className="grid gap-3"
                  onSubmit={handleScheduleSubmit}
                >
                  <div className="grid gap-1">
                    <label className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                      <input
                        type="checkbox"
                        checked={breakGapEnabled}
                        onChange={(e) => setBreakGapEnabled(e.target.checked)}
                        disabled={scheduleControlsDisabled}
                        className={responsiveStyles.scheduleEditorToggle}
                      />
                      Break reminders
                    </label>
                    {breakGapEnabled && (
                      <div className="flex items-center gap-1.5 pl-6 text-sm text-slate-600 dark:text-slate-400">
                        <span>Suggest break at gaps ≥</span>
                        <input
                          type="number"
                          min={1}
                          step={1}
                          value={breakGapInput}
                          onChange={(e) => {
                            setBreakGapInput(e.target.value);
                          }}
                          disabled={scheduleControlsDisabled}
                          aria-label="Break gap threshold in minutes"
                          className={responsiveStyles.scheduleThresholdInput}
                        />
                        <span>min between visits</span>
                      </div>
                    )}
                  </div>

                  <p className="m-0 text-sm font-semibold text-slate-900 dark:text-slate-100">
                    Working hours
                  </p>
                  <p className="m-0 -mt-1 text-xs text-slate-500 dark:text-slate-400">
                    Used to bound route optimization and set lunch break preferences.
                  </p>

                  <div className="rounded-xl border border-slate-200 bg-white px-3 py-1 dark:border-slate-700 dark:bg-slate-900">
                    {DAYS.map(({ key, label }) => {
                      const day = scheduleInput[key]!;
                      return (
                        <div key={key} className={responsiveStyles.scheduleEditorRow}>
                          <span className={responsiveStyles.scheduleEditorDayLabel}>{label}</span>
                          <div>
                            <div className={responsiveStyles.scheduleEditorFields}>
                              <label className="inline-flex items-center text-sm text-slate-700 dark:text-slate-300">
                                <input
                                  type="checkbox"
                                  checked={day.enabled}
                                  onChange={(e) => updateDay(key, { enabled: e.target.checked })}
                                  disabled={scheduleControlsDisabled}
                                  className={responsiveStyles.scheduleEditorToggle}
                                  aria-label={`Enable ${label} working hours`}
                                />
                                <span className="sr-only">{`Enable ${label} working hours`}</span>
                              </label>
                              <div className={responsiveStyles.scheduleEditorTimeRange}>
                                <input
                                  type="time"
                                  value={day.start}
                                  onChange={(e) => updateDay(key, { start: e.target.value })}
                                  disabled={scheduleControlsDisabled || !day.enabled}
                                  step={60}
                                  lang="en-GB"
                                  required={day.enabled}
                                  aria-label={`${label} start time`}
                                  className={responsiveStyles.scheduleEditorTimeInput}
                                />
                                <span className="text-xs text-slate-400">to</span>
                                <input
                                  type="time"
                                  value={day.end}
                                  onChange={(e) => updateDay(key, { end: e.target.value })}
                                  disabled={scheduleControlsDisabled || !day.enabled}
                                  step={60}
                                  lang="en-GB"
                                  required={day.enabled}
                                  aria-label={`${label} end time`}
                                  className={responsiveStyles.scheduleEditorTimeInput}
                                />
                              </div>
                            </div>

                            {day.enabled && (
                              <div className={responsiveStyles.scheduleEditorLunchRow}>
                                <label className="inline-flex items-center gap-1.5">
                                  <input
                                    type="checkbox"
                                    checked={day.lunchBreak?.enabled ?? false}
                                    onChange={(e) =>
                                      updateLunch(key, { enabled: e.target.checked })
                                    }
                                    disabled={scheduleControlsDisabled}
                                    className={responsiveStyles.scheduleEditorToggle}
                                  />
                                  Lunch
                                </label>
                                {day.lunchBreak?.enabled && (
                                  <div className={responsiveStyles.scheduleEditorLunchFields}>
                                    <input
                                      type="time"
                                      value={day.lunchBreak.startTime ?? "12:00"}
                                      onChange={(e) =>
                                        updateLunch(key, { startTime: e.target.value })
                                      }
                                      disabled={scheduleControlsDisabled}
                                      aria-label={`${label} lunch start time`}
                                      className={responsiveStyles.scheduleEditorTimeInput}
                                    />
                                    <input
                                      type="number"
                                      min={1}
                                      step={1}
                                      value={day.lunchBreak.durationMinutes}
                                      onChange={(e) =>
                                        updateLunch(key, {
                                          durationMinutes: Math.max(
                                            1,
                                            Math.trunc(Number(e.target.value) || 1),
                                          ),
                                        })
                                      }
                                      disabled={scheduleControlsDisabled}
                                      aria-label={`${label} lunch duration in minutes`}
                                      className={responsiveStyles.scheduleEditorLunchInput}
                                    />
                                    <span>min</span>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {scheduleError && (
                    <p className="m-0 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/70 dark:bg-red-950/40 dark:text-red-300">
                      {scheduleError}
                    </p>
                  )}
                  {scheduleSuccess && (
                    <p className="m-0 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/40 dark:text-emerald-300">
                      {scheduleSuccess}
                    </p>
                  )}
                </form>
              )}

              {activeSettingsTab === "route" && (
                <form
                  id="account-settings-route-form"
                  className="grid gap-4"
                  onSubmit={handleRouteSettingsSubmit}
                >
                  <div>
                    <p className="m-0 text-sm font-semibold text-slate-900 dark:text-slate-100">
                      How should we plan your route?
                    </p>
                    <p className="m-0 mt-1 text-xs text-slate-500 dark:text-slate-400">
                      Choose what matters more: less driving or finishing sooner.
                    </p>
                  </div>
                  <div className={responsiveStyles.objectiveSelectorGroup}>
                    {(
                      [
                        {
                          value: "distance",
                          label: "Less driving",
                          description: "Fewer kilometers, more efficient routes",
                          badge: "Recommended",
                          icon: (
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.75"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              className="h-4 w-4 shrink-0"
                              aria-hidden="true"
                            >
                              <circle cx="5" cy="18" r="2" />
                              <circle cx="19" cy="6" r="2" />
                              <path d="M7 18h4a5 5 0 0 0 5-5v-1" />
                              <path d="M16 12h3V9" />
                            </svg>
                          ),
                        },
                        {
                          value: "time",
                          label: "Finish sooner",
                          description: "Complete your day earlier — may involve more travel",
                          badge: null,
                          icon: (
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.75"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              className="h-4 w-4 shrink-0"
                              aria-hidden="true"
                            >
                              <circle cx="12" cy="12" r="8" />
                              <path d="M12 8v5l3 2" />
                            </svg>
                          ),
                        },
                      ] as const
                    ).map(({ value, label, description, icon, badge }) => (
                      <label key={value} className={responsiveStyles.objectiveSelectorOption}>
                        <input
                          type="radio"
                          name="optimizationObjective"
                          value={value}
                          checked={routeObjectiveInput === value}
                          onChange={() => setRouteObjectiveInput(value)}
                          disabled={isSavingObjective}
                          className="sr-only"
                        />
                        <div className="flex items-start gap-2">
                          <span className="inline-flex h-5 w-5 items-center justify-center pt-px text-slate-500 dark:text-slate-400">
                            {icon}
                          </span>
                          <div>
                            <p className={`m-0 ${responsiveStyles.objectiveSelectorLabel}`}>
                              {label}
                            </p>
                            <p className={`m-0 ${responsiveStyles.objectiveSelectorDescription}`}>
                              {description}
                            </p>
                            {badge && (
                              <p className="m-0 mt-1 text-xs font-medium text-slate-600 dark:text-slate-400">
                                {badge}
                              </p>
                            )}
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                  {objectiveError && (
                    <p className="m-0 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/70 dark:bg-red-950/40 dark:text-red-300">
                      {objectiveError}
                    </p>
                  )}
                </form>
              )}
            </div>
          </div>

          <div className="-mx-4 mt-4 flex justify-end gap-2 border-t border-slate-200 bg-white px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3 dark:border-slate-800 dark:bg-slate-900 sm:mx-0 sm:px-0 sm:pb-0">
            <button
              type="button"
              onClick={handleClose}
              disabled={isBusy}
              className="rounded-xl bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              form={activeFormId}
              disabled={isActiveSaveDisabled}
              className="rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saveButtonLabel}
            </button>
          </div>
        </div>
      </div>

      {pendingTabSwitch && (
        <ConfirmDialog
          title="Unsaved changes"
          message="You have unsaved changes. Save before leaving?"
          confirmLabel="Leave without saving"
          onConfirm={handleConfirmTabSwitch}
          onCancel={handleCancelTabSwitch}
        />
      )}
    </>
  );
}
