import { useEffect, useRef, useState } from "react";
import { responsiveStyles } from "./responsiveStyles";

export type SelectOption = {
  value: string;
  label: string;
};

type SelectFieldProps = {
  id?: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  "aria-label"?: string;
};

export const SelectField = ({
  id,
  value,
  options,
  onChange,
  "aria-label": ariaLabel,
}: SelectFieldProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((o) => o.value === value);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleOutsideClick);
    }
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [isOpen]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setIsOpen(false);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setIsOpen((prev) => !prev);
    } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const currentIndex = options.findIndex((o) => o.value === value);
      const nextIndex =
        e.key === "ArrowDown"
          ? Math.min(currentIndex + 1, options.length - 1)
          : Math.max(currentIndex - 1, 0);
      onChange(options[nextIndex].value);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        id={id}
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((prev) => !prev)}
        onKeyDown={handleKeyDown}
        className={`${responsiveStyles.formSelect} flex items-center justify-between gap-2 text-left`}
      >
        <span className="truncate">{selectedOption?.label ?? value}</span>
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className={`shrink-0 text-slate-500 transition-transform dark:text-slate-400 ${isOpen ? "rotate-180" : ""}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {isOpen && (
        <ul
          role="listbox"
          aria-label={ariaLabel}
          className="absolute left-0 right-0 z-30 mt-1 max-h-60 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-lg dark:border-slate-700 dark:bg-slate-900"
        >
          {options.map((option) => {
            const isSelected = option.value === value;
            return (
              <li
                key={option.value}
                role="option"
                aria-selected={isSelected}
                onMouseDown={(e) => {
                  e.preventDefault();
                  onChange(option.value);
                  setIsOpen(false);
                }}
                className={`flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm transition ${
                  isSelected
                    ? "bg-blue-50 font-semibold text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
                    : "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                }`}
              >
                {option.label}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};
