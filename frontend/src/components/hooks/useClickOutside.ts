import { useEffect, useRef, useState } from "react";

/**
 * Manages open/close state for a dropdown, closing it on click-outside or Escape.
 * Returns [isOpen, setIsOpen, containerRef].
 */
export function useClickOutside<T extends HTMLElement>(): [
  boolean,
  React.Dispatch<React.SetStateAction<boolean>>,
  React.RefObject<T | null>,
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

/**
 * Controlled variant for externally-owned open/expanded state: while `active`
 * is true, calls `onDismiss` on a pointer-down outside the returned ref or on
 * Escape. Use when the open state lives elsewhere (e.g. a lifted/persisted
 * controller flag) rather than inside this hook.
 */
export function useDismissOnOutside<T extends HTMLElement>(
  active: boolean,
  onDismiss: () => void,
): React.RefObject<T | null> {
  const ref = useRef<T>(null);
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;

  useEffect(() => {
    if (!active) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        onDismissRef.current();
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onDismissRef.current();
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [active]);

  return ref;
}
