import { useEffect, useState } from "react";

const SCROLL_THRESHOLD = 20;

/**
 * Returns true when the page has scrolled past SCROLL_THRESHOLD pixels.
 * Used to drive the "shrunk" header state.
 */
export function useScrollShrink(): boolean {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > SCROLL_THRESHOLD);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return scrolled;
}
