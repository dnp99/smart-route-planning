import { useEffect, useState } from "react";
import { updatePassword, updateProfileHomeAddress, updateWorkingHours } from "../auth/authService";
import { clearAuthSession, getAuthToken, setStoredAuthUser } from "../auth/authSession";
import type { DaySchedule, WeeklyWorkingHours } from "../../../../shared/contracts";

const MAX_HOME_ADDRESS_LENGTH = 200;
const MIN_PASSWORD_LENGTH = 8;
const DEFAULT_BREAK_GAP_THRESHOLD = 30;

export const DAYS = [
  { key: "monday" as const, label: "Mon" },
  { key: "tuesday" as const, label: "Tue" },
  { key: "wednesday" as const, label: "Wed" },
  { key: "thursday" as const, label: "Thu" },
  { key: "friday" as const, label: "Fri" },
  { key: "saturday" as const, label: "Sat" },
  { key: "sunday" as const, label: "Sun" },
] as const;

type DayKey = (typeof DAYS)[number]["key"];

const DEFAULT_DAY_SCHEDULE: DaySchedule = {
  enabled: false,
  start: "09:00",
  end: "17:00",
  lunchBreak: { enabled: false, durationMinutes: 30 },
};

export const buildDefaultSchedule = (
  existing: WeeklyWorkingHours | null | undefined,
): WeeklyWorkingHours => {
  const result: WeeklyWorkingHours = {};
  for (const { key } of DAYS) {
    const day = existing?.[key];
    result[key] = {
      enabled: day?.enabled ?? false,
      start: day?.start ?? DEFAULT_DAY_SCHEDULE.start,
      end: day?.end ?? DEFAULT_DAY_SCHEDULE.end,
      lunchBreak: {
        enabled: day?.lunchBreak?.enabled ?? false,
        durationMinutes: day?.lunchBreak?.durationMinutes ?? 30,
      },
    };
  }
  return result;
};

type AuthUser = {
  displayName?: string;
  email?: string;
  homeAddress?: string;
  workingHours?: WeeklyWorkingHours | null;
  breakGapThresholdMinutes?: number | null;
} | null;

type UseAccountSettingsParams = {
  authUser: AuthUser;
  isOpen: boolean;
  onClose: () => void;
  onSaved: (updatedUser: AuthUser) => void;
};

export function useAccountSettings({
  authUser,
  isOpen,
  onClose,
  onSaved,
}: UseAccountSettingsParams) {
  // ── Home address form ────────────────────────────────────────────────────────
  const [homeAddressInput, setHomeAddressInput] = useState("");
  const [accountSettingsError, setAccountSettingsError] = useState("");
  const [accountSettingsSuccess, setAccountSettingsSuccess] = useState("");
  const [isSavingAccountSettings, setIsSavingAccountSettings] = useState(false);

  // ── Password form ────────────────────────────────────────────────────────────
  const [currentPasswordInput, setCurrentPasswordInput] = useState("");
  const [newPasswordInput, setNewPasswordInput] = useState("");
  const [confirmPasswordInput, setConfirmPasswordInput] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // ── Working hours / schedule form ────────────────────────────────────────────
  const [scheduleInput, setScheduleInput] = useState<WeeklyWorkingHours>(() =>
    buildDefaultSchedule(null),
  );
  const [breakGapInput, setBreakGapInput] = useState<string>(String(DEFAULT_BREAK_GAP_THRESHOLD));
  const [scheduleError, setScheduleError] = useState("");
  const [scheduleSuccess, setScheduleSuccess] = useState("");
  const [isSavingSchedule, setIsSavingSchedule] = useState(false);

  const isBusy = isSavingAccountSettings || isUpdatingPassword || isSavingSchedule;

  // Reset all form state when modal opens
  useEffect(() => {
    if (!isOpen) return;
    setHomeAddressInput(authUser?.homeAddress ?? "");
    setAccountSettingsError("");
    setAccountSettingsSuccess("");
    setCurrentPasswordInput("");
    setNewPasswordInput("");
    setConfirmPasswordInput("");
    setPasswordError("");
    setPasswordSuccess("");
    setShowCurrentPassword(false);
    setShowNewPassword(false);
    setShowConfirmPassword(false);
    setScheduleInput(buildDefaultSchedule(authUser?.workingHours));
    setBreakGapInput(String(authUser?.breakGapThresholdMinutes ?? DEFAULT_BREAK_GAP_THRESHOLD));
    setScheduleError("");
    setScheduleSuccess("");
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  // Escape to close (re-registers whenever busy state changes)
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") handleClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isSavingAccountSettings, isUpdatingPassword, isSavingSchedule]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleClose = () => {
    if (isBusy) return;
    setAccountSettingsError("");
    setAccountSettingsSuccess("");
    setPasswordError("");
    setPasswordSuccess("");
    setScheduleError("");
    setScheduleSuccess("");
    onClose();
  };

  const handleAccountSettingsSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAccountSettingsError("");
    setAccountSettingsSuccess("");

    const normalized = homeAddressInput.trim();
    if (!normalized) {
      setAccountSettingsError("Home address is required.");
      return;
    }
    if (normalized.length > MAX_HOME_ADDRESS_LENGTH) {
      setAccountSettingsError("Home address must be 200 characters or fewer.");
      return;
    }

    const token = getAuthToken();
    if (!token || !authUser) {
      clearAuthSession();
      return;
    }

    setIsSavingAccountSettings(true);
    try {
      const updated = await updateProfileHomeAddress(token, normalized);
      setStoredAuthUser(updated.user);
      onSaved(updated.user);
      setAccountSettingsSuccess("Account settings saved.");
    } catch (err) {
      setAccountSettingsError(
        err instanceof Error ? err.message : "Unable to update account settings.",
      );
    } finally {
      setIsSavingAccountSettings(false);
    }
  };

  const handlePasswordUpdateSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPasswordError("");
    setPasswordSuccess("");

    if (!currentPasswordInput.trim()) {
      setPasswordError("Current password is required.");
      return;
    }
    if (newPasswordInput.length < MIN_PASSWORD_LENGTH) {
      setPasswordError(`New password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (newPasswordInput !== confirmPasswordInput) {
      setPasswordError("Passwords do not match.");
      return;
    }
    if (currentPasswordInput === newPasswordInput) {
      setPasswordError("New password must differ from current password.");
      return;
    }

    const token = getAuthToken();
    if (!token || !authUser) {
      clearAuthSession();
      return;
    }

    setIsUpdatingPassword(true);
    try {
      await updatePassword(token, currentPasswordInput, newPasswordInput);
      setCurrentPasswordInput("");
      setNewPasswordInput("");
      setConfirmPasswordInput("");
      setPasswordSuccess("Password updated successfully.");
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : "Unable to update password.");
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const handleScheduleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setScheduleError("");
    setScheduleSuccess("");

    for (const { key, label } of DAYS) {
      const day = scheduleInput[key];
      if (!day?.enabled) continue;

      const startMin = Number(day.start.split(":")[0]) * 60 + Number(day.start.split(":")[1]);
      const endMin = Number(day.end.split(":")[0]) * 60 + Number(day.end.split(":")[1]);

      if (endMin <= startMin) {
        setScheduleError(`${label}: end time must be after start time.`);
        return;
      }

      if (day.lunchBreak?.enabled) {
        const dur = day.lunchBreak.durationMinutes;
        if (!dur || dur < 1 || !Number.isInteger(dur)) {
          setScheduleError(`${label}: lunch break duration must be a positive whole number.`);
          return;
        }
        if (dur >= endMin - startMin) {
          setScheduleError(`${label}: lunch break duration must be less than working day length.`);
          return;
        }
      }
    }

    const parsedBreakGap = parseInt(breakGapInput, 10);
    if (isNaN(parsedBreakGap) || parsedBreakGap < 1) {
      setScheduleError("Break card threshold must be a positive number.");
      return;
    }

    const token = getAuthToken();
    if (!token || !authUser) {
      clearAuthSession();
      return;
    }

    setIsSavingSchedule(true);
    try {
      const updated = await updateWorkingHours(token, scheduleInput, parsedBreakGap);
      setStoredAuthUser(updated.user);
      onSaved(updated.user);
      setScheduleSuccess("Working hours saved.");
    } catch (err) {
      setScheduleError(err instanceof Error ? err.message : "Unable to save working hours.");
    } finally {
      setIsSavingSchedule(false);
    }
  };

  const updateDay = (key: DayKey, patch: Partial<DaySchedule>) => {
    setScheduleInput((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));
    if (scheduleError) setScheduleError("");
    if (scheduleSuccess) setScheduleSuccess("");
  };

  const updateLunch = (key: DayKey, patch: Partial<NonNullable<DaySchedule["lunchBreak"]>>) => {
    setScheduleInput((prev) => {
      const day = prev[key]!;
      return {
        ...prev,
        [key]: {
          ...day,
          lunchBreak: { ...day.lunchBreak, ...patch } as NonNullable<DaySchedule["lunchBreak"]>,
        },
      };
    });
    if (scheduleError) setScheduleError("");
    if (scheduleSuccess) setScheduleSuccess("");
  };

  return {
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
    breakGapInput,
    setBreakGapInput,
    scheduleError,
    scheduleSuccess,
    isSavingSchedule,
    handleScheduleSubmit,
    updateDay,
    updateLunch,
    // Shared
    isBusy,
    handleClose,
  };
}
