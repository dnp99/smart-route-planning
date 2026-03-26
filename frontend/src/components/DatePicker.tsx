import { useState, useRef, useEffect, useCallback } from "react";
import { responsiveStyles } from "./responsiveStyles";

type DatePickerProps = {
  value: string;
  onChange: (date: string) => void;
  compact?: boolean;
  id?: string;
  ariaLabel?: string;
  required?: boolean;
  maxDaysAhead?: number;
};

const WEEKDAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"] as const;
const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

const toDateString = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const parseDate = (value: string): Date | null => {
  const parts = value.split("-");
  if (parts.length !== 3) return null;
  const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  return isNaN(d.getTime()) ? null : d;
};

const isSameDay = (a: Date, b: Date): boolean =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

const formatDisplay = (value: string): string => {
  const d = parseDate(value);
  if (!d) return value;
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
};

const getDaysInMonth = (year: number, month: number): number =>
  new Date(year, month + 1, 0).getDate();

const getFirstDayOfWeek = (year: number, month: number): number =>
  new Date(year, month, 1).getDay();

export const DatePicker = ({
  value,
  onChange,
  compact = false,
  id,
  ariaLabel,
  maxDaysAhead = 14,
}: DatePickerProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const maxDate = new Date(today);
  maxDate.setDate(maxDate.getDate() + maxDaysAhead);

  const selectedDate = parseDate(value);
  const [viewYear, setViewYear] = useState(selectedDate?.getFullYear() ?? today.getFullYear());
  const [viewMonth, setViewMonth] = useState(selectedDate?.getMonth() ?? today.getMonth());

  useEffect(() => {
    if (!isOpen) return;
    const parsed = parseDate(value);
    if (parsed) {
      setViewYear(parsed.getFullYear());
      setViewMonth(parsed.getMonth());
    }
  }, [isOpen, value]);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen]);

  const navigateMonth = useCallback(
    (delta: number) => {
      let newMonth = viewMonth + delta;
      let newYear = viewYear;
      if (newMonth < 0) {
        newMonth = 11;
        newYear -= 1;
      } else if (newMonth > 11) {
        newMonth = 0;
        newYear += 1;
      }

      const firstOfNew = new Date(newYear, newMonth, 1);
      const lastOfNew = new Date(newYear, newMonth + 1, 0);

      if (delta < 0 && lastOfNew < today) return;
      if (delta > 0 && firstOfNew > maxDate) return;

      setViewYear(newYear);
      setViewMonth(newMonth);
    },
    [viewMonth, viewYear, today, maxDate],
  );

  const handleDayClick = (day: number) => {
    const clicked = new Date(viewYear, viewMonth, day);
    if (clicked < today || clicked > maxDate) return;
    onChange(toDateString(clicked));
    setIsOpen(false);
  };

  const handleTodayClick = () => {
    onChange(toDateString(today));
    setIsOpen(false);
  };

  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const firstDay = getFirstDayOfWeek(viewYear, viewMonth);

  const canGoPrev = (() => {
    const prevLast = new Date(viewYear, viewMonth, 0);
    return prevLast >= today;
  })();

  const canGoNext = (() => {
    const nextFirst = new Date(viewYear, viewMonth + 1, 1);
    return nextFirst <= maxDate;
  })();

  return (
    <div ref={containerRef} className="relative">
      <button
        id={id}
        type="button"
        onClick={() => setIsOpen((o) => !o)}
        aria-label={ariaLabel ?? "Select planning date"}
        aria-expanded={isOpen}
        className={
          compact ? responsiveStyles.dateInputTriggerCompact : responsiveStyles.dateInputTrigger
        }
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="shrink-0 text-slate-400"
          aria-hidden="true"
        >
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
        <span className={value ? "text-slate-900 dark:text-slate-100" : "text-slate-400"}>
          {value ? formatDisplay(value) : "Select date"}
        </span>
      </button>

      {isOpen && (
        <div className={responsiveStyles.calendarPopover} role="dialog" aria-label="Date picker">
          <div className={responsiveStyles.calendarNav}>
            <button
              type="button"
              onClick={() => navigateMonth(-1)}
              disabled={!canGoPrev}
              className={responsiveStyles.calendarNavButton}
              aria-label="Previous month"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
            <span className={responsiveStyles.calendarMonthLabel}>
              {MONTH_NAMES[viewMonth]} {viewYear}
            </span>
            <button
              type="button"
              onClick={() => navigateMonth(1)}
              disabled={!canGoNext}
              className={responsiveStyles.calendarNavButton}
              aria-label="Next month"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <polyline points="9 6 15 12 9 18" />
              </svg>
            </button>
          </div>

          <table className={responsiveStyles.calendarGrid} role="grid">
            <thead>
              <tr>
                {WEEKDAY_LABELS.map((d) => (
                  <th key={d} className={responsiveStyles.calendarHeadCell} scope="col">
                    {d}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(() => {
                const rows: React.ReactNode[] = [];
                let dayCounter = 1;
                const totalCells = Math.ceil((firstDay + daysInMonth) / 7) * 7;

                for (let i = 0; i < totalCells; i += 7) {
                  const cells: React.ReactNode[] = [];
                  for (let j = 0; j < 7; j++) {
                    const cellIndex = i + j;
                    if (cellIndex < firstDay || dayCounter > daysInMonth) {
                      cells.push(<td key={cellIndex} />);
                    } else {
                      const day = dayCounter;
                      const cellDate = new Date(viewYear, viewMonth, day);
                      const isDisabled = cellDate < today || cellDate > maxDate;
                      const isSelected = selectedDate !== null && isSameDay(cellDate, selectedDate);
                      const isToday = isSameDay(cellDate, today);

                      let dayStyle = responsiveStyles.calendarDayDefault;
                      if (isDisabled) dayStyle = responsiveStyles.calendarDayDisabled;
                      else if (isSelected) dayStyle = responsiveStyles.calendarDaySelected;
                      else if (isToday) dayStyle = responsiveStyles.calendarDayToday;

                      cells.push(
                        <td key={cellIndex} className="text-center">
                          <button
                            type="button"
                            disabled={isDisabled}
                            onClick={() => handleDayClick(day)}
                            className={`${responsiveStyles.calendarDayBase} ${dayStyle}`}
                            aria-label={`${MONTH_NAMES[viewMonth]} ${day}, ${viewYear}`}
                            aria-selected={isSelected}
                            aria-current={isToday ? "date" : undefined}
                          >
                            {day}
                          </button>
                        </td>,
                      );
                      dayCounter++;
                    }
                  }
                  rows.push(<tr key={i}>{cells}</tr>);
                }
                return rows;
              })()}
            </tbody>
          </table>

          <div className={responsiveStyles.calendarFooter}>
            <button
              type="button"
              onClick={handleTodayClick}
              className={responsiveStyles.calendarFooterLink}
            >
              Today
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
