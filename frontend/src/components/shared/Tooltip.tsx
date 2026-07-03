import type { ReactNode } from "react";
import { responsiveStyles } from "../responsiveStyles";

type TooltipProps = {
  /** Text shown on hover/keyboard focus of the wrapped control. */
  label: string;
  /** The trigger — typically an icon-only button. */
  children: ReactNode;
};

// Lightweight CSS-only hover/focus tooltip for icon-only controls. The bubble is
// purely visual (aria-hidden) — the trigger's own aria-label is the accessible
// name, so screen readers aren't given the label twice.
export function Tooltip({ label, children }: TooltipProps) {
  return (
    <span className={responsiveStyles.tooltipWrapper}>
      {children}
      <span aria-hidden="true" className={responsiveStyles.tooltipBubble}>
        {label}
      </span>
    </span>
  );
}
