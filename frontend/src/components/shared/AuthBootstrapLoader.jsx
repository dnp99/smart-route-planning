import { useEffect, useState } from "react";
import RoutefyBrandMark from "../../assets/RoutefyBrandMark";
import { responsiveStyles } from "../responsiveStyles";

const AUTH_BOOTSTRAP_STEPS = [
  "Checking credentials",
  "Loading your routes",
  "Syncing client data",
  "Almost there",
];

export default function AuthBootstrapLoader() {
  const [stepIndex, setStepIndex] = useState(0);
  const [dots, setDots] = useState("");

  useEffect(() => {
    const dotTimer = window.setInterval(() => {
      setDots((currentDots) => (currentDots.length >= 3 ? "" : `${currentDots}.`));
    }, 400);

    return () => window.clearInterval(dotTimer);
  }, []);

  useEffect(() => {
    const stepTimer = window.setTimeout(() => {
      setStepIndex((currentStepIndex) => (currentStepIndex + 1) % AUTH_BOOTSTRAP_STEPS.length);
    }, 1200);

    return () => window.clearTimeout(stepTimer);
  }, [stepIndex]);

  return (
    <div
      className={`${responsiveStyles.appShell} items-center justify-center px-4`}
      role="status"
      aria-live="polite"
    >
      <main className="w-full max-w-md rounded-3xl border border-slate-200 bg-white px-6 py-10 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:px-8">
        <div className="flex items-center justify-center gap-2">
          <RoutefyBrandMark className="h-5 w-5 text-blue-600 dark:text-blue-300" />
          <span className="text-xs font-semibold tracking-[0.18em] text-blue-900 dark:text-blue-100">
            ROUTEFY
          </span>
        </div>

        <div className="relative mt-8 flex items-center justify-center">
          <div className="absolute h-16 w-16 rounded-full border-2 border-blue-200/80 dark:border-blue-800/50" />
          <div className="absolute h-20 w-20 rounded-full border border-blue-200/50 dark:border-blue-800/40" />
          <div className="absolute h-16 w-16 animate-ping rounded-full bg-blue-100/40 dark:bg-blue-900/30" />
          <div className="relative z-10 flex h-14 w-14 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-950/40">
            <RoutefyBrandMark className="h-8 w-8 text-blue-600 dark:text-blue-300" />
          </div>
        </div>

        <div className="mt-8 text-center">
          <p className="m-0 text-sm font-medium text-slate-800 dark:text-slate-100">
            {AUTH_BOOTSTRAP_STEPS[stepIndex]}
            <span className="inline-block w-5 text-blue-600 dark:text-blue-300">{dots}</span>
          </p>
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-blue-100 dark:bg-blue-950/50">
            <div
              className="h-full rounded-full bg-blue-600 transition-all duration-500 ease-out dark:bg-blue-400"
              style={{ width: `${((stepIndex + 1) / AUTH_BOOTSTRAP_STEPS.length) * 100}%` }}
            />
          </div>
          <p className="m-0 mt-2 text-xs tracking-[0.03em] text-slate-500 dark:text-slate-400">
            Validating your session
          </p>
        </div>

        <div className="mt-5 flex items-center justify-center gap-2">
          {AUTH_BOOTSTRAP_STEPS.map((_, index) => (
            <span
              key={`auth-bootstrap-dot-${index}`}
              className={[
                "h-1.5 w-1.5 rounded-full transition-all duration-300",
                index <= stepIndex ? "bg-blue-600 dark:bg-blue-400" : "bg-blue-200 dark:bg-blue-800",
                index === stepIndex ? "scale-125" : "scale-100",
              ].join(" ")}
              aria-hidden="true"
            />
          ))}
        </div>
      </main>
    </div>
  );
}
