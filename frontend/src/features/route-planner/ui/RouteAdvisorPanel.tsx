import type { RouteAdvisorResponse } from "../../../../../shared/contracts";
import { responsiveStyles } from "../../../components/responsiveStyles";

type RouteAdvisorPanelProps = {
  advice: RouteAdvisorResponse | null;
  isLoading: boolean;
  error: string;
  unavailable: boolean;
  onRequestAdvice: () => void;
};

const SparkleIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    className="shrink-0"
  >
    <path d="M12 3l1.9 4.8L18.6 9l-4.7 1.9L12 15.6l-1.9-4.7L5.4 9l4.7-1.2L12 3z" />
    <path d="M19 14l.8 2.1L22 17l-2.2.9L19 20l-.8-2.1L16 17l2.2-.9L19 14z" />
  </svg>
);

const CheckIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    className="mt-1 shrink-0 text-blue-500 dark:text-blue-400"
  >
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

export function RouteAdvisorPanel({
  advice,
  isLoading,
  error,
  unavailable,
  onRequestAdvice,
}: RouteAdvisorPanelProps) {
  // No API key configured server-side — the feature is simply absent.
  if (unavailable) {
    return null;
  }

  return (
    <div className={responsiveStyles.routeAdvisorCard}>
      <div className={responsiveStyles.routeAdvisorHeader}>
        <p className={responsiveStyles.routeAdvisorEyebrow}>
          <SparkleIcon />
          Route Advisor
        </p>
        {!isLoading && !advice && (
          <button
            type="button"
            onClick={onRequestAdvice}
            className={responsiveStyles.routeAdvisorButton}
          >
            <SparkleIcon />
            {error ? "Try again" : "Get AI advice"}
          </button>
        )}
      </div>

      {isLoading && (
        <div className="mt-2 flex flex-col gap-2" aria-live="polite" aria-busy="true">
          <span className="sr-only">Getting route advice…</span>
          <div className={`${responsiveStyles.routeAdvisorSkeletonLine} w-11/12`} />
          <div className={`${responsiveStyles.routeAdvisorSkeletonLine} w-4/5`} />
          <div className={`${responsiveStyles.routeAdvisorSkeletonLine} w-2/3`} />
        </div>
      )}

      {!isLoading && advice && (
        <>
          <p className={responsiveStyles.routeAdvisorBrief}>{advice.brief}</p>
          {advice.suggestions.length > 0 && (
            <ul className={responsiveStyles.routeAdvisorSuggestionList}>
              {advice.suggestions.map((suggestion, index) => (
                <li key={index} className={responsiveStyles.routeAdvisorSuggestion}>
                  <CheckIcon />
                  <span>{suggestion}</span>
                </li>
              ))}
            </ul>
          )}
          <p className={responsiveStyles.routeAdvisorDisclaimer}>
            AI-generated from your optimized route. It summarizes the plan — it doesn&apos;t change
            the stop order or times.
          </p>
        </>
      )}

      {!isLoading && !advice && error && (
        <p className={responsiveStyles.routeAdvisorError}>{error}</p>
      )}
    </div>
  );
}
