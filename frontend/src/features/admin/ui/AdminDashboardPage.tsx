import { responsiveStyles } from "../../../components/responsiveStyles";
import type { AdminMetrics, AdminNurseSummary } from "../api/adminService";
import { formatDate, formatRelative } from "./adminFormatters";

type AdminDashboardPageProps = {
  nurses: AdminNurseSummary[];
  metrics: AdminMetrics | null;
  isLoading: boolean;
  error: string;
  onSelectNurse: (nurseId: string) => void;
};

type Kpi = { label: string; value: string; hint: string };

const buildKpis = (metrics: AdminMetrics | null): Kpi[] => {
  if (!metrics) {
    return [
      { label: "Nurses", value: "—", hint: "—" },
      { label: "New signups (7d)", value: "—", hint: "—" },
      { label: "Active nurses (WAU)", value: "—", hint: "—" },
      { label: "Clients added (7d)", value: "—", hint: "—" },
    ];
  }
  return [
    {
      label: "Nurses",
      value: String(metrics.nurses.total),
      hint: `${metrics.nurses.active} active`,
    },
    {
      label: "New signups (7d)",
      value: String(metrics.signups.last7Days),
      hint: `${metrics.signups.total} all time`,
    },
    {
      label: "Active nurses (WAU)",
      value: String(metrics.activeNurses.wau),
      hint: `${metrics.activeNurses.dau} today`,
    },
    {
      label: "Clients added (7d)",
      value: String(metrics.clientsAdded.last7Days),
      hint: `${metrics.clientsAdded.last30Days} in 30d`,
    },
  ];
};

const AdminDashboardPage = ({
  nurses,
  metrics,
  isLoading,
  error,
  onSelectNurse,
}: AdminDashboardPageProps) => {
  const kpis = buildKpis(metrics);

  return (
    <div className="flex flex-col gap-6">
      {error && <p className={responsiveStyles.inlineErrorBanner}>{error}</p>}

      <section className={responsiveStyles.dashboardKpiGrid}>
        {kpis.map((kpi) => (
          <div key={kpi.label} className={responsiveStyles.dashboardKpiCard}>
            <p className={responsiveStyles.dashboardKpiLabel}>{kpi.label}</p>
            <p className={responsiveStyles.dashboardKpiValue}>{isLoading ? "—" : kpi.value}</p>
            <p className={`${responsiveStyles.cardDescription} mt-1`}>
              {isLoading ? " " : kpi.hint}
            </p>
          </div>
        ))}
      </section>

      <section className={responsiveStyles.adminCard}>
        <h2 className={responsiveStyles.adminSectionTitle}>Users</h2>
        <p className={`${responsiveStyles.cardDescription} mt-1 mb-4`}>
          {isLoading ? "Loading…" : `${nurses.length} nurse${nurses.length === 1 ? "" : "s"}`}
        </p>

        <div className={responsiveStyles.adminTableWrap}>
          <table className={responsiveStyles.adminTable}>
            <thead>
              <tr>
                <th className={responsiveStyles.adminTableHeadCell}>Nurse</th>
                <th className={responsiveStyles.adminTableHeadCell}>Signed up</th>
                <th className={responsiveStyles.adminTableHeadCell}>Last login</th>
                <th className={responsiveStyles.adminTableHeadCell}>Last active</th>
                <th className={responsiveStyles.adminTableHeadCell}>Clients</th>
                <th className={responsiveStyles.adminTableHeadCell}>Status</th>
              </tr>
            </thead>
            <tbody>
              {!isLoading && nurses.length === 0 && (
                <tr>
                  <td className={responsiveStyles.adminEmptyRow} colSpan={6}>
                    No nurses yet.
                  </td>
                </tr>
              )}
              {nurses.map((nurse) => (
                <tr
                  key={nurse.id}
                  className={responsiveStyles.adminTableRow}
                  onClick={() => onSelectNurse(nurse.id)}
                >
                  <td className={responsiveStyles.adminTableCell}>
                    <span className="block font-semibold text-slate-900 dark:text-slate-100">
                      {nurse.displayName}
                    </span>
                    <span className="block text-xs text-slate-500 dark:text-slate-400">
                      {nurse.email}
                    </span>
                  </td>
                  <td className={responsiveStyles.adminTableCell}>{formatDate(nurse.createdAt)}</td>
                  <td className={responsiveStyles.adminTableCell}>
                    {formatRelative(nurse.lastLoginAt)}
                  </td>
                  <td className={responsiveStyles.adminTableCell}>
                    {formatRelative(nurse.lastActivityAt)}
                  </td>
                  <td className={responsiveStyles.adminTableCell}>{nurse.activePatientCount}</td>
                  <td className={responsiveStyles.adminTableCell}>
                    <span
                      className={
                        nurse.isActive
                          ? responsiveStyles.adminStatusActive
                          : responsiveStyles.adminStatusInactive
                      }
                    >
                      {nurse.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};

export default AdminDashboardPage;
