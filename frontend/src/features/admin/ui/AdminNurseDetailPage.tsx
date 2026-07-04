import { useState } from "react";
import ConfirmDialog from "../../../components/modals/ConfirmDialog";
import { responsiveStyles } from "../../../components/responsiveStyles";
import type { AdminNurseDetail } from "../api/adminService";
import { describeAction, formatDate, formatDateTime } from "./adminFormatters";
import NurseRouteRunsSection from "./NurseRouteRunsSection";
import Pagination from "./Pagination";
import { usePagination } from "../hooks/usePagination";

const CLIENTS_PAGE_SIZE = 20;

type AdminNurseDetailPageProps = {
  detail: AdminNurseDetail | null;
  isLoading: boolean;
  error: string;
  onBack: () => void;
  isBusy: boolean;
  actionError: string;
  temporaryPassword: string | null;
  onDeactivate: () => Promise<void>;
  onReactivate: () => Promise<void>;
  onResetPassword: () => Promise<void>;
  onDismissTemporaryPassword: () => void;
};

type PendingAction = "deactivate" | "reactivate" | "resetPassword";

const CONFIRM_COPY: Record<
  PendingAction,
  { title: string; message: string; confirmLabel: string; variant: "destructive" | "primary" }
> = {
  deactivate: {
    title: "Deactivate nurse?",
    message: "They won't be able to log in until an admin reactivates the account.",
    confirmLabel: "Deactivate",
    variant: "destructive",
  },
  reactivate: {
    title: "Reactivate nurse?",
    message: "They'll be able to log in again.",
    confirmLabel: "Reactivate",
    variant: "primary",
  },
  resetPassword: {
    title: "Reset password?",
    message:
      "This sets a one-time temporary password and forces a change at next login. Their current password stops working immediately.",
    confirmLabel: "Reset password",
    variant: "destructive",
  },
};

const AdminNurseDetailPage = ({
  detail,
  isLoading,
  error,
  onBack,
  isBusy,
  actionError,
  temporaryPassword,
  onDeactivate,
  onReactivate,
  onResetPassword,
  onDismissTemporaryPassword,
}: AdminNurseDetailPageProps) => {
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const clientsPage = usePagination(detail?.patients ?? [], CLIENTS_PAGE_SIZE);

  const runners: Record<PendingAction, () => Promise<void>> = {
    deactivate: onDeactivate,
    reactivate: onReactivate,
    resetPassword: onResetPassword,
  };

  const confirmPending = async () => {
    if (!pendingAction) {
      return;
    }
    const run = runners[pendingAction];
    try {
      await run();
    } finally {
      setPendingAction(null);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <button type="button" className={responsiveStyles.adminBackLink} onClick={onBack}>
        ← Back to users
      </button>

      {error && <p className={responsiveStyles.inlineErrorBanner}>{error}</p>}
      {isLoading && <p className={responsiveStyles.cardDescription}>Loading…</p>}

      {detail && (
        <>
          <section className={responsiveStyles.adminCard}>
            <p className={responsiveStyles.adminEyebrow}>Nurse</p>
            <h2 className={responsiveStyles.adminSectionTitle}>{detail.nurse.displayName}</h2>
            <p className={`${responsiveStyles.cardDescription} mt-1 mb-4`}>{detail.nurse.email}</p>

            <div className={responsiveStyles.adminMetaGrid}>
              <div>
                <p className={responsiveStyles.adminMetaLabel}>Status</p>
                <p className={responsiveStyles.adminMetaValue}>
                  {detail.nurse.isActive ? "Active" : "Inactive"}
                </p>
              </div>
              <div>
                <p className={responsiveStyles.adminMetaLabel}>Signed up</p>
                <p className={responsiveStyles.adminMetaValue}>
                  {formatDate(detail.nurse.createdAt)}
                </p>
              </div>
              <div>
                <p className={responsiveStyles.adminMetaLabel}>Last login</p>
                <p className={responsiveStyles.adminMetaValue}>
                  {formatDateTime(detail.nurse.lastLoginAt)}
                </p>
              </div>
              <div>
                <p className={responsiveStyles.adminMetaLabel}>Home address</p>
                <p className={responsiveStyles.adminMetaValue}>{detail.nurse.homeAddress || "—"}</p>
              </div>
              <div>
                <p className={responsiveStyles.adminMetaLabel}>Password reset required</p>
                <p className={responsiveStyles.adminMetaValue}>
                  {detail.nurse.mustChangePassword ? "Yes" : "No"}
                </p>
              </div>
            </div>

            {actionError && (
              <p className={`${responsiveStyles.inlineErrorBanner} mt-4`}>{actionError}</p>
            )}

            <div className={responsiveStyles.adminActionRow}>
              {detail.nurse.isActive ? (
                <button
                  type="button"
                  className={responsiveStyles.adminDangerButton}
                  onClick={() => setPendingAction("deactivate")}
                  disabled={isBusy}
                >
                  Deactivate
                </button>
              ) : (
                <button
                  type="button"
                  className={responsiveStyles.adminActionButton}
                  onClick={() => setPendingAction("reactivate")}
                  disabled={isBusy}
                >
                  Reactivate
                </button>
              )}
              <button
                type="button"
                className={responsiveStyles.adminActionButton}
                onClick={() => setPendingAction("resetPassword")}
                disabled={isBusy}
              >
                Reset password
              </button>
            </div>

            {temporaryPassword && (
              <div className={responsiveStyles.adminTempPanel}>
                <p className="m-0 text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Temporary password
                </p>
                <p className={`${responsiveStyles.cardDescription} m-0 mt-1`}>
                  Share this with the nurse. They&apos;ll be required to change it at their next
                  login. It won&apos;t be shown again.
                </p>
                <code className={responsiveStyles.adminTempCode}>{temporaryPassword}</code>
                <div className="mt-3">
                  <button
                    type="button"
                    className={responsiveStyles.adminActionButton}
                    onClick={onDismissTemporaryPassword}
                  >
                    Done
                  </button>
                </div>
              </div>
            )}
          </section>

          <section className={responsiveStyles.adminCard}>
            <h2 className={responsiveStyles.adminSectionTitle}>
              Clients ({detail.patients.length})
            </h2>
            <div className={`${responsiveStyles.adminTableWrap} mt-3`}>
              <table className={responsiveStyles.adminTable}>
                <thead>
                  <tr>
                    <th className={responsiveStyles.adminTableHeadCell}>Name</th>
                    <th className={responsiveStyles.adminTableHeadCell}>Address</th>
                    <th className={responsiveStyles.adminTableHeadCell}>Added</th>
                    <th className={responsiveStyles.adminTableHeadCell}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.patients.length === 0 && (
                    <tr>
                      <td className={responsiveStyles.adminEmptyRow} colSpan={4}>
                        No clients.
                      </td>
                    </tr>
                  )}
                  {clientsPage.pageItems.map((patient) => (
                    <tr key={patient.id}>
                      <td className={responsiveStyles.adminTableCell}>
                        {patient.firstName} {patient.lastName}
                      </td>
                      <td className={responsiveStyles.adminTableCell}>{patient.address}</td>
                      <td className={responsiveStyles.adminTableCell}>
                        {formatDate(patient.createdAt)}
                      </td>
                      <td className={responsiveStyles.adminTableCell}>
                        <span
                          className={
                            patient.isActive
                              ? responsiveStyles.adminStatusActive
                              : responsiveStyles.adminStatusInactive
                          }
                        >
                          {patient.isActive
                            ? "Active"
                            : patient.archivedAt
                              ? "Archived"
                              : "Inactive"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination
              page={clientsPage.page}
              pageCount={clientsPage.pageCount}
              onPageChange={clientsPage.setPage}
            />
          </section>

          <NurseRouteRunsSection nurseId={detail.nurse.id} />

          <section className={responsiveStyles.adminCard}>
            <h2 className={responsiveStyles.adminSectionTitle}>
              Recent activity ({detail.activity.length})
            </h2>
            {detail.activity.length === 0 ? (
              <p className={`${responsiveStyles.cardDescription} mt-2`}>No activity recorded.</p>
            ) : (
              <ul className="m-0 mt-3 flex list-none flex-col p-0">
                {detail.activity.map((event) => (
                  <li key={event.id} className={responsiveStyles.adminFeedItem}>
                    <div className="min-w-0">
                      <p className="m-0 text-sm font-medium text-slate-900 dark:text-slate-100">
                        {describeAction(event.action)}
                        {event.outcome !== "success" && (
                          <span className={`${responsiveStyles.adminFeedDenied} ml-2`}>
                            {event.outcome}
                          </span>
                        )}
                      </p>
                      <p className={`${responsiveStyles.adminFeedMeta} m-0`}>
                        {event.ipAddress ? `${event.ipAddress} · ` : ""}
                        {event.resourceType}
                      </p>
                    </div>
                    <span className={`${responsiveStyles.adminFeedMeta} shrink-0`}>
                      {formatDateTime(event.createdAt)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      {pendingAction && (
        <ConfirmDialog
          title={CONFIRM_COPY[pendingAction].title}
          message={CONFIRM_COPY[pendingAction].message}
          confirmLabel={CONFIRM_COPY[pendingAction].confirmLabel}
          confirmLoadingLabel="Working…"
          confirmVariant={CONFIRM_COPY[pendingAction].variant}
          isLoading={isBusy}
          onConfirm={() => void confirmPending()}
          onCancel={() => setPendingAction(null)}
        />
      )}
    </div>
  );
};

export default AdminNurseDetailPage;
