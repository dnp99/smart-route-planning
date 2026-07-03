import { useEffect, useState } from "react";
import AddressAutocompleteInput from "../shared/AddressAutocompleteInput";
import ConfirmDialog from "./ConfirmDialog";
import { responsiveStyles } from "../responsiveStyles";
import { useAccountSettings, DAYS, buildDefaultSchedule } from "../hooks/useAccountSettings";
import type { AuthUser as SharedAuthUser } from "../../../../shared/contracts";

const MAX_HOME_ADDRESS_LENGTH = 200;
const MAX_DISPLAY_NAME_LENGTH = 120;
const PROFILE_MODAL_HOME_ADDRESS_ID = "account-settings-home-address";

type SettingsTab = "profile" | "working-hours" | "route";

interface AccountSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  authUser: SharedAuthUser | null;
  onHomeAddressSaved: (updatedUser: SharedAuthUser | null) => void;
  /** Tab to open on. Lets callers deep-link (e.g. "Set hours" → Working hours). */
  initialTab?: SettingsTab;
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

const SETTINGS_TABS: readonly SettingsTab[] = ["profile", "working-hours", "route"];
// Guard against an unexpected initialTab (e.g. a click Event passed by mistake)
// so the modal always shows a real tab rather than an empty body.
const normalizeSettingsTab = (tab: unknown): SettingsTab =>
  SETTINGS_TABS.includes(tab as SettingsTab) ? (tab as SettingsTab) : "profile";

const resolveSettingsTabClassName = (isActive: boolean) =>
  [
    responsiveStyles.settingsTabButtonBase,
    isActive
      ? responsiveStyles.settingsTabButtonActive
      : responsiveStyles.settingsTabButtonInactive,
  ].join(" ");

export default function AccountSettingsModal({
  isOpen,
  onClose,
  authUser,
  onHomeAddressSaved,
  initialTab = "profile",
}: AccountSettingsModalProps) {
  const [showBreakReminderInfo, setShowBreakReminderInfo] = useState(false);
  const [activeSettingsTab, setActiveSettingsTab] = useState<SettingsTab>(
    normalizeSettingsTab(initialTab),
  );
  const [pendingTabSwitch, setPendingTabSwitch] = useState<
    "profile" | "working-hours" | "route" | null
  >(null);

  // Open on the requested tab each time the modal is shown (e.g. the checklist's
  // "Set hours" deep-links straight to Working hours).
  useEffect(() => {
    if (isOpen) {
      setActiveSettingsTab(normalizeSettingsTab(initialTab));
      setPendingTabSwitch(null);
    }
  }, [isOpen, initialTab]);
  const currentOptimizationObjective = authUser?.optimizationObjective ?? "time";
  const [routeObjectiveInput, setRouteObjectiveInput] = useState<"time" | "distance">(
    currentOptimizationObjective,
  );
  const {
    // Profile
    displayNameInput,
    setDisplayNameInput,
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
  const normalizedSavedDisplayName = (authUser?.displayName ?? "").trim();
  const normalizedDisplayNameInput = displayNameInput.trim();
  const hasProfileDisplayNameChanges = normalizedDisplayNameInput !== normalizedSavedDisplayName;
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
      return hasProfileDisplayNameChanges || hasProfileAddressChanges || isProfilePasswordMode;
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
        : isSavingAccountSettings || (!hasProfileDisplayNameChanges && !hasProfileAddressChanges)
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
          <div className={responsiveStyles.modalSheetHandleWrap}>
            <div className={responsiveStyles.modalSheetHandle} />
          </div>
          <div className={responsiveStyles.infoModalHeader}>
            <div>
              <h2 className={responsiveStyles.accountSettingsTitle}>Account settings</h2>
              <p className={responsiveStyles.accountSettingsDescription}>
                Manage account profile details for route-planning defaults.
              </p>
            </div>
            <button
              type="button"
              onClick={handleClose}
              disabled={isBusy}
              aria-label="Close modal"
              className={responsiveStyles.modalCloseButton}
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
                  <label className={responsiveStyles.accountSettingsFieldLabel}>
                    <span className="font-medium">Display name</span>
                    <input
                      type="text"
                      value={displayNameInput}
                      onChange={(event) => {
                        setDisplayNameInput(event.target.value.slice(0, MAX_DISPLAY_NAME_LENGTH));
                        if (accountSettingsError) setAccountSettingsError("");
                      }}
                      autoComplete="name"
                      disabled={isSavingAccountSettings}
                      className={responsiveStyles.accountSettingsInput}
                    />
                  </label>

                  <label className={responsiveStyles.accountSettingsFieldLabel}>
                    <span className="font-medium">Email</span>
                    <input
                      type="email"
                      value={authUser?.email ?? ""}
                      readOnly
                      disabled
                      className={responsiveStyles.accountSettingsReadOnlyInput}
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
                    <p className={responsiveStyles.inlineErrorBanner}>{accountSettingsError}</p>
                  )}
                  {accountSettingsSuccess && (
                    <p className={responsiveStyles.inlineSuccessBanner}>{accountSettingsSuccess}</p>
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
                      <label key={field} className={responsiveStyles.accountSettingsFieldLabel}>
                        <span className="font-medium">{label}</span>
                        <div className="relative">
                          <input
                            type={show ? "text" : "password"}
                            value={value}
                            onChange={(e) => setValue(e.target.value)}
                            autoComplete={autoComplete}
                            disabled={isUpdatingPassword}
                            className={[
                              responsiveStyles.accountSettingsPasswordInputBase,
                              isConfirm
                                ? confirmBorderClass
                                : "border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-slate-700",
                            ].join(" ")}
                          />
                          <button
                            type="button"
                            onClick={() => setShow((v) => !v)}
                            aria-label={show ? "Hide password" : "Show password"}
                            className={responsiveStyles.passwordVisibilityButton}
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
                    <p className={responsiveStyles.inlineErrorBanner}>{passwordError}</p>
                  )}
                  {passwordSuccess && (
                    <p className={responsiveStyles.inlineSuccessBanner}>{passwordSuccess}</p>
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
                    <div className="inline-flex items-center gap-2">
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
                      <button
                        type="button"
                        aria-label="Show break reminder info"
                        aria-expanded={showBreakReminderInfo}
                        onClick={() => setShowBreakReminderInfo((current) => !current)}
                        className={responsiveStyles.onboardingBreakToggleButton}
                      >
                        i
                      </button>
                    </div>
                    {showBreakReminderInfo && (
                      <p className={responsiveStyles.breakReminderInfoBanner}>
                        Break reminders suggest a break card when there is at least this many idle
                        minutes between visits.
                      </p>
                    )}
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

                  <div className={responsiveStyles.accountSettingsScheduleCard}>
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
                    <p className={responsiveStyles.inlineErrorBanner}>{scheduleError}</p>
                  )}
                  {scheduleSuccess && (
                    <p className={responsiveStyles.inlineSuccessBanner}>{scheduleSuccess}</p>
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
                          <span className={responsiveStyles.objectiveSelectorIcon}>{icon}</span>
                          <div>
                            <p className={`m-0 ${responsiveStyles.objectiveSelectorLabel}`}>
                              {label}
                            </p>
                            <p className={`m-0 ${responsiveStyles.objectiveSelectorDescription}`}>
                              {description}
                            </p>
                            {badge && (
                              <p className={responsiveStyles.objectiveSelectorBadge}>{badge}</p>
                            )}
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                  {objectiveError && (
                    <p className={responsiveStyles.inlineErrorBanner}>{objectiveError}</p>
                  )}
                </form>
              )}
            </div>
          </div>

          <div className={responsiveStyles.accountSettingsFooterBar}>
            <button
              type="button"
              onClick={handleClose}
              disabled={isBusy}
              className={responsiveStyles.accountSettingsSecondaryButton}
            >
              Cancel
            </button>
            <button
              type="submit"
              form={activeFormId}
              disabled={isActiveSaveDisabled}
              className={responsiveStyles.accountSettingsPrimaryButton}
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
