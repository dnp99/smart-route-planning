import { useEffect } from "react";
import { formatNameWords } from "../../features/patients/domain/patientName";
import { responsiveStyles } from "../responsiveStyles";
import { useClickOutside } from "../hooks/useClickOutside";

type AuthUser = { displayName?: string; email?: string; homeAddress?: string } | null;

interface AccountMenuProps {
  authUser: AuthUser;
  isAuthenticated: boolean;
  onOpenAccountSettings: () => void;
  onLogout: () => void;
  /** "avatar" = circular initials button (top bar); "card" = name + email row (sidebar). */
  variant?: "avatar" | "card";
  className?: string;
}

export const resolveAccountInitials = (displayName?: string, email?: string) => {
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

const SettingsIcon = () => (
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
);

const LogoutIcon = () => (
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
);

export default function AccountMenu({
  authUser,
  isAuthenticated,
  onOpenAccountSettings,
  onLogout,
  variant = "avatar",
  className,
}: AccountMenuProps) {
  const [isOpen, setIsOpen, menuRef] = useClickOutside<HTMLDivElement>();

  useEffect(() => {
    if (!isAuthenticated) setIsOpen(false);
  }, [isAuthenticated, setIsOpen]);

  const initials = resolveAccountInitials(authUser?.displayName, authUser?.email);
  const name = formatNameWords(authUser?.displayName ?? "") || (authUser?.email ?? "Account");
  const email = authUser?.email ?? "";

  const dropdown = isOpen && (
    <div
      role="menu"
      aria-label="Account options menu"
      className={
        variant === "card"
          ? responsiveStyles.accountMenuDropdownUp
          : responsiveStyles.accountMenuDropdown
      }
    >
      <button
        type="button"
        role="menuitem"
        onClick={() => {
          setIsOpen(false);
          onOpenAccountSettings();
        }}
        className={responsiveStyles.accountMenuItem}
      >
        <SettingsIcon />
        Account settings
      </button>
      <hr className="my-1 border-slate-200 dark:border-slate-700" />
      <button
        type="button"
        role="menuitem"
        onClick={() => {
          setIsOpen(false);
          onLogout();
        }}
        className={responsiveStyles.accountMenuItemDestructive}
      >
        <LogoutIcon />
        Logout
      </button>
    </div>
  );

  if (variant === "card") {
    return (
      <div ref={menuRef} className={["relative", className].filter(Boolean).join(" ")}>
        <button
          type="button"
          onClick={() => setIsOpen((v) => !v)}
          aria-haspopup="menu"
          aria-expanded={isOpen}
          className={responsiveStyles.sidebarAccountCard}
        >
          <span className={responsiveStyles.sidebarAccountAvatar} aria-hidden="true">
            {initials}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-semibold text-slate-900 dark:text-slate-100">
              {name}
            </span>
            {email && (
              <span className="block truncate text-[11px] font-medium text-slate-400 dark:text-slate-500">
                {email}
              </span>
            )}
          </span>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className={`h-4 w-4 shrink-0 text-slate-400 transition-transform dark:text-slate-500 ${isOpen ? "rotate-180" : ""}`}
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>
        {dropdown}
      </div>
    );
  }

  return (
    <div ref={menuRef} className={["relative", className].filter(Boolean).join(" ")}>
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        aria-label="Open account options menu"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        title="Open account options menu"
        className={responsiveStyles.accountMenuButton}
      >
        <span aria-hidden="true" className="block leading-none">
          {initials}
        </span>
      </button>
      {dropdown}
    </div>
  );
}
