import { useEffect, useState } from "react";
import { responsiveStyles } from "../responsiveStyles";

const TOUR_VIDEO_SRC = "/onboarding/tour.mp4";
const TOUR_POSTER_SRC = "/onboarding/tour-poster.jpg";

type OnboardingTourProps = {
  /** Dismiss the card (latched per-nurse by the parent). */
  onDismiss: () => void;
};

const PlayIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
    <path d="M8 5v14l11-7z" />
  </svg>
);

const CloseIcon = ({ className }: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    className={className}
  >
    <path d="M18 6 6 18M6 6l12 12" />
  </svg>
);

// New-user onboarding tour: a compact card on the dashboard that opens a modal
// video player. Visibility (new user, not yet dismissed) is owned by the parent.
export function OnboardingTour({ onDismiss }: OnboardingTourProps) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isOpen]);

  return (
    <>
      <section className={responsiveStyles.tourCard} aria-label="Product tour">
        <span className={responsiveStyles.tourThumb} aria-hidden="true">
          <img className={responsiveStyles.tourThumbImg} src={TOUR_POSTER_SRC} alt="" />
          <span className={responsiveStyles.tourPlayBadge}>
            <PlayIcon className="ml-0.5 h-4 w-4" />
          </span>
        </span>
        <div className={responsiveStyles.tourCopy}>
          <p className={responsiveStyles.tourEyebrow}>New here?</p>
          <p className={responsiveStyles.tourTitle}>Take the 30-second tour</p>
          <p className={responsiveStyles.tourSub}>
            See how to set your hours, add clients, and plan an optimized route.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className={responsiveStyles.tourWatchButton}
        >
          <PlayIcon className="h-3.5 w-3.5" />
          Watch tour
        </button>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss tour"
          title="Dismiss"
          className={responsiveStyles.tourDismissButton}
        >
          <CloseIcon className="h-4 w-4" />
        </button>
      </section>

      {isOpen && (
        <div
          className={responsiveStyles.modalBackdrop}
          role="dialog"
          aria-modal="true"
          aria-label="Routefy product tour"
          onPointerDown={(event) => {
            if (event.target === event.currentTarget) {
              setIsOpen(false);
            }
          }}
        >
          <div className={responsiveStyles.tourModalSurface}>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              aria-label="Close video"
              className={responsiveStyles.tourModalClose}
            >
              <CloseIcon className="h-4 w-4" />
            </button>
            {/* Silent screen recording — no dialogue to caption. */}
            <video
              className={responsiveStyles.tourVideo}
              src={TOUR_VIDEO_SRC}
              poster={TOUR_POSTER_SRC}
              controls
              autoPlay
              playsInline
            />
          </div>
        </div>
      )}
    </>
  );
}
