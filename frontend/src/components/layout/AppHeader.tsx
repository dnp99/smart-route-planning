import { useEffect, useState } from "react";
import nurseQuotes from "../../data/nurseQuotes";
import { formatNameWords } from "../patients/patientName";
import { responsiveStyles } from "../responsiveStyles";
import { useScrollShrink } from "../hooks/useScrollShrink";
import { useClickOutside } from "../hooks/useClickOutside";

const HEADER_QUOTE_STORAGE_KEY = "careflow.headerQuote";

type Quote = { content: string };
type AuthUser = { displayName?: string; email?: string; homeAddress?: string } | null;

interface AppHeaderProps {
  isAuthenticated: boolean;
  authUser: AuthUser;
  onOpenAccountSettings: () => void;
  onLogout: () => void;
}

const pickRandomQuote = (currentQuote: Quote | null = null): Quote | null => {
  if (!Array.isArray(nurseQuotes) || nurseQuotes.length === 0) return null;
  if (nurseQuotes.length === 1) return nurseQuotes[0];
  let next = nurseQuotes[Math.floor(Math.random() * nurseQuotes.length)];
  if (currentQuote?.content) {
    while (next.content === currentQuote.content) {
      next = nurseQuotes[Math.floor(Math.random() * nurseQuotes.length)];
    }
  }
  return next;
};

const readStoredHeaderQuote = (): Quote | null => {
  if (typeof window === "undefined") return null;
  const stored = window.localStorage.getItem(HEADER_QUOTE_STORAGE_KEY);
  if (!stored) return null;
  return (nurseQuotes as Quote[]).find((q) => q.content === stored) ?? null;
};

const OptionsIcon = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    className={className}
  >
    <circle cx="12" cy="5" r="1.5" />
    <circle cx="12" cy="12" r="1.5" />
    <circle cx="12" cy="19" r="1.5" />
  </svg>
);

export default function AppHeader({
  isAuthenticated,
  authUser,
  onOpenAccountSettings,
  onLogout,
}: AppHeaderProps) {
  const [isAccountMenuOpen, setIsAccountMenuOpen, accountMenuRef] =
    useClickOutside<HTMLDivElement>();
  const headerScrolled = useScrollShrink();
  const [headerQuote, setHeaderQuote] = useState<Quote | null>(() => readStoredHeaderQuote());

  // Close menu when logged out
  useEffect(() => {
    if (!isAuthenticated) setIsAccountMenuOpen(false);
  }, [isAuthenticated, setIsAccountMenuOpen]);

  // Quote management
  useEffect(() => {
    if (!isAuthenticated) {
      setHeaderQuote(null);
      if (typeof window !== "undefined") {
        window.localStorage.removeItem(HEADER_QUOTE_STORAGE_KEY);
      }
      return;
    }
    setHeaderQuote((current) => {
      const next = current ?? readStoredHeaderQuote() ?? pickRandomQuote();
      if (next && typeof window !== "undefined") {
        window.localStorage.setItem(HEADER_QUOTE_STORAGE_KEY, next.content);
      }
      return next;
    });
  }, [isAuthenticated]);

  const formattedDisplayName =
    typeof authUser?.displayName === "string" ? formatNameWords(authUser.displayName) : "";
  const workspaceSubtitle = formattedDisplayName
    ? `Nurse operations workspace for ${formattedDisplayName}`
    : "Nurse operations workspace";

  return (
    <header className={responsiveStyles.appHeader}>
      <div
        className={[responsiveStyles.appHeaderInner, headerScrolled ? "py-2" : "py-3 sm:py-4"].join(
          " ",
        )}
      >
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-950/40">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              className="h-5 w-5 text-blue-600 dark:text-blue-400"
            >
              <path d="M1 12 L5 12 L7 5 L9 19 L11 12 L13 12" />
              <path d="M19 5C16.8 5 15 6.8 15 9C15 11.8 19 17 19 17C19 17 23 11.8 23 9C23 6.8 21.2 5 19 5Z" />
              <circle cx="19" cy="9" r="1.8" fill="currentColor" strokeWidth="0" />
            </svg>
          </div>
          <div className="min-w-0">
            <p className="m-0 text-base font-semibold uppercase tracking-[0.16em] text-blue-600 dark:text-blue-300 sm:text-lg">
              CareFlow
            </p>
            <p
              className={[
                "m-0 mt-0.5 truncate text-xs text-slate-500 transition-all duration-300 sm:text-sm dark:text-slate-400",
                headerScrolled ? "max-h-0 overflow-hidden opacity-0" : "max-h-8 opacity-100",
              ].join(" ")}
            >
              {workspaceSubtitle}
            </p>
          </div>
        </div>

        <div className="ml-auto flex min-w-0 items-center gap-2">
          {isAuthenticated && headerQuote && !headerScrolled && (
            <p className={responsiveStyles.headerQuote}>&ldquo;{headerQuote.content}&rdquo;</p>
          )}

          {!isAuthenticated && (
            <p className="m-0 text-xs font-semibold text-slate-500 dark:text-slate-400">
              {new Date().toLocaleDateString("en-US", {
                weekday: "short",
                month: "short",
                day: "numeric",
              })}
            </p>
          )}

          {isAuthenticated && (
            <div ref={accountMenuRef} className="relative">
              <button
                type="button"
                onClick={() => setIsAccountMenuOpen((v) => !v)}
                aria-label="Open account options menu"
                aria-haspopup="menu"
                aria-expanded={isAccountMenuOpen}
                title="Open account options menu"
                className={responsiveStyles.accountMenuButton}
              >
                <OptionsIcon className="h-4 w-4" />
              </button>

              {isAccountMenuOpen && (
                <div
                  role="menu"
                  aria-label="Account options menu"
                  className={responsiveStyles.accountMenuDropdown}
                >
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setIsAccountMenuOpen(false);
                      onOpenAccountSettings();
                    }}
                    className="flex w-full items-center gap-2.5 whitespace-nowrap rounded-lg px-2.5 py-2 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="15"
                      height="15"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                    Account settings
                  </button>
                  <hr className="my-1 border-slate-200 dark:border-slate-700" />
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setIsAccountMenuOpen(false);
                      onLogout();
                    }}
                    className="flex w-full items-center gap-2.5 whitespace-nowrap rounded-lg px-2.5 py-2 text-left text-sm font-medium text-red-600 transition hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="15"
                      height="15"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                      <polyline points="16 17 21 12 16 7" />
                      <line x1="21" y1="12" x2="9" y2="12" />
                    </svg>
                    Logout
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
