import { useEffect } from "react";
import { formatNameWords } from "../patients/patientName";
import { responsiveStyles } from "../responsiveStyles";
import { useScrollShrink } from "../hooks/useScrollShrink";
import { useClickOutside } from "../hooks/useClickOutside";

type AuthUser = { displayName?: string; email?: string; homeAddress?: string } | null;

interface AppHeaderProps {
  isAuthenticated: boolean;
  authUser: AuthUser;
  onOpenAccountSettings: () => void;
  onLogout: () => void;
}

const resolveAccountInitials = (displayName?: string, email?: string) => {
  const normalizedDisplayName = formatNameWords(displayName ?? "");
  if (normalizedDisplayName.length > 0) {
    const parts = normalizedDisplayName.split(" ").filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return normalizedDisplayName.slice(0, 2).toUpperCase();
  }

  const localEmail = (email ?? "").trim().split("@")[0];
  const emailTokens = localEmail
    .split(/[.\-_]/)
    .map((token) => token.trim())
    .filter(Boolean);
  if (emailTokens.length >= 2) {
    return `${emailTokens[0][0]}${emailTokens[1][0]}`.toUpperCase();
  }
  if (localEmail.length > 0) {
    return localEmail.slice(0, 2).toUpperCase();
  }

  return "CF";
};

export default function AppHeader({
  isAuthenticated,
  authUser,
  onOpenAccountSettings,
  onLogout,
}: AppHeaderProps) {
  const [isAccountMenuOpen, setIsAccountMenuOpen, accountMenuRef] =
    useClickOutside<HTMLDivElement>();
  const headerScrolled = useScrollShrink();

  // Close menu when logged out
  useEffect(() => {
    if (!isAuthenticated) setIsAccountMenuOpen(false);
  }, [isAuthenticated, setIsAccountMenuOpen]);

  const formattedDisplayName =
    typeof authUser?.displayName === "string" ? formatNameWords(authUser.displayName) : "";
  const accountInitials = resolveAccountInitials(authUser?.displayName, authUser?.email);
  const workspaceSubtitle = formattedDisplayName
    ? `Operations workspace for ${formattedDisplayName}`
    : "Operations workspace";

  return (
    <header
      className={[
        responsiveStyles.appHeader,
        "bg-[linear-gradient(135deg,rgba(255,255,255,0.96)_0%,rgba(248,250,252,0.94)_58%,rgba(236,254,255,0.92)_100%)]",
        "dark:bg-[linear-gradient(135deg,rgba(2,6,23,0.96)_0%,rgba(15,23,42,0.94)_60%,rgba(8,47,73,0.9)_100%)]",
      ].join(" ")}
    >
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
            <p className="m-0 text-base sm:text-lg lg:text-2xl font-semibold uppercase tracking-[0.16em] text-blue-600 dark:text-blue-300">
              Routefy
            </p>
          </div>
        </div>

        <div className="ml-auto flex min-w-0 items-center gap-2">
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
                <span aria-hidden="true" className="block leading-none">
                  {accountInitials}
                </span>
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
