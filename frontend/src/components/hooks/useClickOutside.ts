import { useEffect, useRef, useState } from "react";

/**
 * Manages open/close state for a dropdown, closing it on click-outside or Escape.
 * Returns [isOpen, setIsOpen, containerRef].
 */
export function useClickOutside<T extends HTMLElement>(): [
  boolean,
  React.Dispatch<React.SetStateAction<boolean>>,
  React.RefObject<T>,
] {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<T>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  return [isOpen, setIsOpen, ref];
}
