import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { responsiveStyles } from "../responsiveStyles";
import {
  useNotifications,
  type NotificationItem,
  type NotificationsAuthUser,
} from "./useNotifications";

type NotificationsMenuProps = {
  authUser: NotificationsAuthUser;
  onOpenAccountSettings: () => void;
  className?: string;
};

const BellIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.9"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    className="h-[18px] w-[18px]"
  >
    <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </svg>
);

const SeverityIcon = ({ severity }: { severity: NotificationItem["severity"] }) => (
  <span
    className={
      severity === "action"
        ? responsiveStyles.notificationsIconAction
        : responsiveStyles.notificationsIconInfo
    }
    aria-hidden="true"
  >
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {severity === "action" ? (
        <>
          <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </>
      ) : (
        <>
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="16" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12.01" y2="8" />
        </>
      )}
    </svg>
  </span>
);

const NotificationRow = ({
  item,
  onNavigate,
}: {
  item: NotificationItem;
  onNavigate: () => void;
}) => {
  const body = (
    <>
      <SeverityIcon severity={item.severity} />
      <span className="min-w-0">
        <span className={responsiveStyles.notificationsItemTitle}>{item.title}</span>
        <span className={`${responsiveStyles.notificationsItemDetail} block`}>{item.detail}</span>
      </span>
    </>
  );

  if (item.to) {
    return (
      <Link to={item.to} onClick={onNavigate} className={responsiveStyles.notificationsItem}>
        {body}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        onNavigate();
        item.onSelect?.();
      }}
      className={responsiveStyles.notificationsItem}
    >
      {body}
    </button>
  );
};

export default function NotificationsMenu({
  authUser,
  onOpenAccountSettings,
  className = "",
}: NotificationsMenuProps) {
  const { items, hasUnread, markAllRead } = useNotifications(authUser, onOpenAccountSettings);
  const [isOpen, setIsOpen] = useState(false);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  const open = () => {
    if (triggerRef.current) {
      setAnchorRect(triggerRef.current.getBoundingClientRect());
    }
    setIsOpen(true);
    markAllRead();
  };

  const close = () => {
    setIsOpen(false);
    setAnchorRect(null);
  };

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const onMouseDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      close();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKeyDown);
    // Fixed-positioned panel would detach from the bell on scroll/resize — close.
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [isOpen]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label="Notifications"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onClick={() => (isOpen ? close() : open())}
        className={`${responsiveStyles.topBarIconButton} ${className}`}
      >
        <BellIcon />
        {hasUnread && <span className={responsiveStyles.notificationsDot} />}
      </button>

      {isOpen &&
        anchorRect &&
        createPortal(
          <div
            ref={panelRef}
            role="menu"
            aria-label="Notifications"
            className={responsiveStyles.notificationsPanel}
            style={{
              position: "fixed",
              top: anchorRect.bottom + 8,
              right: Math.max(12, window.innerWidth - anchorRect.right),
              zIndex: 60,
            }}
          >
            <div className={responsiveStyles.notificationsPanelHeader}>
              <p className={responsiveStyles.notificationsPanelTitle}>Notifications</p>
            </div>
            {items.length === 0 ? (
              <p className={responsiveStyles.notificationsEmpty}>You&apos;re all caught up.</p>
            ) : (
              <div className="flex flex-col divide-y divide-slate-100 dark:divide-slate-800">
                {items.map((item) => (
                  <NotificationRow key={item.id} item={item} onNavigate={close} />
                ))}
              </div>
            )}
          </div>,
          document.body,
        )}
    </>
  );
}
