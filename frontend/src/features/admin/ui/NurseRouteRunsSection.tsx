import { responsiveStyles } from "../../../components/responsiveStyles";
import { useNurseRouteRuns } from "../hooks/useNurseRouteRuns";
import { formatDate, formatDistanceKm, formatDuration } from "./adminFormatters";

const objectiveLabel = (objective: string | null): string => {
  if (objective === "time") return "Finish sooner";
  if (objective === "distance") return "Less driving";
  return "—";
};

// Self-contained route-run history for one nurse (owns its own paginated data
// via useNurseRouteRuns). First page is the last 7 days; Load more pages older.
const NurseRouteRunsSection = ({ nurseId }: { nurseId: string }) => {
  const { runs, hasMore, isLoading, isLoadingMore, error, loadMore } = useNurseRouteRuns(nurseId);

  return (
    <section className={responsiveStyles.adminCard}>
      <h2 className={responsiveStyles.adminSectionTitle}>Route runs</h2>
      <p className={`${responsiveStyles.cardDescription} mt-1 mb-3`}>
        Optimizations run by this nurse (last 7 days first).
      </p>

      {error && <p className={responsiveStyles.inlineErrorBanner}>{error}</p>}

      {isLoading ? (
        <p className={responsiveStyles.cardDescription}>Loading…</p>
      ) : runs.length === 0 ? (
        <p className={responsiveStyles.cardDescription}>No route runs in the last 7 days.</p>
      ) : (
        <>
          <div className={responsiveStyles.adminTableWrap}>
            <table className={responsiveStyles.adminTable}>
              <thead>
                <tr>
                  <th className={responsiveStyles.adminTableHeadCell}>Date</th>
                  <th className={responsiveStyles.adminTableHeadCell}>Stops</th>
                  <th className={responsiveStyles.adminTableHeadCell}>Drive time</th>
                  <th className={responsiveStyles.adminTableHeadCell}>On-time</th>
                  <th className={responsiveStyles.adminTableHeadCell}>Distance</th>
                  <th className={responsiveStyles.adminTableHeadCell}>Mode</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((run) => (
                  <tr key={run.id}>
                    <td className={responsiveStyles.adminTableCell}>
                      {formatDate(run.planningDate)}
                    </td>
                    <td className={responsiveStyles.adminTableCell}>
                      {run.scheduledVisitCount}
                      {run.unscheduledVisitCount > 0 && (
                        <span className={`${responsiveStyles.cardDescription} ml-1`}>
                          (+{run.unscheduledVisitCount} unscheduled)
                        </span>
                      )}
                    </td>
                    <td className={responsiveStyles.adminTableCell}>
                      {formatDuration(run.totalDurationSeconds)}
                    </td>
                    <td className={responsiveStyles.adminTableCell}>
                      {run.onTimeVisitCount}/{run.scheduledVisitCount}
                    </td>
                    <td className={responsiveStyles.adminTableCell}>
                      {formatDistanceKm(run.totalDistanceMeters)}
                    </td>
                    <td className={responsiveStyles.adminTableCell}>
                      {objectiveLabel(run.optimizationObjective)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {hasMore && (
            <div className="mt-4">
              <button
                type="button"
                className={responsiveStyles.adminActionButton}
                onClick={() => void loadMore()}
                disabled={isLoadingMore}
              >
                {isLoadingMore ? "Loading…" : "Load more"}
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
};

export default NurseRouteRunsSection;
