import { useCallback, useState } from "react";
import { deactivateNurse, reactivateNurse, resetNursePassword } from "../api/adminService";

// Admin mutations for a single nurse. Deactivate/reactivate refresh the detail
// via onChanged; reset surfaces the one-time temporary password to show once.
export const useAdminNurseActions = (nurseId: string | undefined, onChanged: () => void) => {
  const [isBusy, setIsBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const [temporaryPassword, setTemporaryPassword] = useState<string | null>(null);

  const run = useCallback(
    async (action: () => Promise<void>) => {
      if (!nurseId) {
        return;
      }
      setIsBusy(true);
      setActionError("");
      try {
        await action();
      } catch (error) {
        setActionError(error instanceof Error ? error.message : "Action failed.");
      } finally {
        setIsBusy(false);
      }
    },
    [nurseId],
  );

  const deactivate = useCallback(
    () =>
      run(async () => {
        await deactivateNurse(nurseId as string);
        onChanged();
      }),
    [run, nurseId, onChanged],
  );

  const reactivate = useCallback(
    () =>
      run(async () => {
        await reactivateNurse(nurseId as string);
        onChanged();
      }),
    [run, nurseId, onChanged],
  );

  const resetPassword = useCallback(
    () =>
      run(async () => {
        const temp = await resetNursePassword(nurseId as string);
        setTemporaryPassword(temp);
        onChanged();
      }),
    [run, nurseId, onChanged],
  );

  const dismissTemporaryPassword = useCallback(() => setTemporaryPassword(null), []);

  return {
    isBusy,
    actionError,
    temporaryPassword,
    deactivate,
    reactivate,
    resetPassword,
    dismissTemporaryPassword,
  };
};
