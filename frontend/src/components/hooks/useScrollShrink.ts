import { useEffect, useRef, useState } from "react";

// The header compacts by removing the subtitle (~34px) and reducing padding
// (~8px) — a total layout shift of ~42–50px depending on breakpoint. If the
// scroll threshold is lower than that delta, the layout shift itself drops
// scrollY below the exit threshold, causing the header to re-expand and loop.
//
// Fix: SCROLL_THRESHOLD_IN is set well above the maximum layout-shift delta so
// post-shift scrollY stays above SCROLL_THRESHOLD_OUT. A transition lock then
// ignores scroll events for the duration of the CSS animation as belt-and-suspenders.
const SCROLL_THRESHOLD_IN = 96; // must scroll past this to enter shrunk state
const SCROLL_THRESHOLD_OUT = 32; // must scroll below this to exit shrunk state
const TRANSITION_LOCK_MS = 350; // slightly longer than the 300ms CSS transition

/**
 * Returns true when the page has scrolled far enough to shrink the header.
 * Uses hysteresis + a post-transition lock so the header never oscillates.
 */
export function useScrollShrink(): boolean {
  const [scrolled, setScrolled] = useState(false);
  const stateRef = useRef(false);
  const lockedUntilRef = useRef(0);

  useEffect(() => {
    const handleScroll = () => {
      if (Date.now() < lockedUntilRef.current) return;

      const y = window.scrollY;
      const curr = stateRef.current;

      if (!curr && y > SCROLL_THRESHOLD_IN) {
        stateRef.current = true;
        lockedUntilRef.current = Date.now() + TRANSITION_LOCK_MS;
        setScrolled(true);
      } else if (curr && y < SCROLL_THRESHOLD_OUT) {
        stateRef.current = false;
        lockedUntilRef.current = Date.now() + TRANSITION_LOCK_MS;
        setScrolled(false);
      }
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return scrolled;
}
