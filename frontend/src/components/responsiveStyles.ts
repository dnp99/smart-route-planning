// ─── Design Tokens ────────────────────────────────────────────────────────────
//  Specification: docs/design-system.md
//
//  All UI styling flows through this file. Components consume these tokens
//  instead of writing ad-hoc Tailwind classes, keeping both pages visually
//  consistent. Rules:
//
//  Background  bg-slate-50  (page canvas — never used for cards)
//  Surface     bg-white     (all cards, inputs, table rows)
//  Border      border-slate-200  (default)  / border-slate-300 (hover)
//  Primary     bg-blue-600 hover:bg-blue-700
//  Shadow      shadow-sm (cards)  — never stack more than one shadow level
//  Radius      rounded-2xl (cards/sections)  rounded-xl (buttons/inputs/pills)
//
//  Typography
//    h1   text-2xl font-semibold text-slate-900
//    h2   text-xl  font-semibold text-slate-900
//    h3   text-lg  font-semibold text-slate-900
//    body text-sm  text-slate-900
//    sec  text-sm  text-slate-600
//    muted text-xs text-slate-400

export const responsiveStyles = {
  // ── App shell (layout components) ─────────────────────────────────────────
  // Page canvas (design 2a): flat white shell. The transparent sidebar + content
  // read against it; secondary tiles use `surfaceSecondary` (#F4F4F6) for contrast.
  appCanvas: "bg-white dark:bg-slate-950",
  appShell: "flex min-h-screen flex-col bg-white dark:bg-slate-950",
  stickyHeaderShell: "sticky top-0 z-30 w-full",
  // Frosted top bar that blends into the white page canvas on scroll.
  appHeader: "relative z-40 w-full bg-white/80 backdrop-blur-md dark:bg-slate-950/80",
  appHeaderBackgroundGradient: "",
  appHeaderInner: "mx-auto flex w-full max-w-7xl items-center justify-between px-6",
  // Secondary tile surface (design 2a): warm light-gray on the white canvas.
  // For sidebar tiles, stat/KPI cards, and other supporting surfaces — NOT for
  // primary/hero cards or data tables, which stay bg-white.
  surfaceSecondary: "bg-[#F4F4F6] border border-[#E2E8F0] dark:bg-slate-900 dark:border-slate-800",
  tabStrip: "relative z-30 w-full bg-slate-50/95 backdrop-blur-sm dark:bg-slate-950/95",
  // Borderless footer over the flat white canvas (design 2a) — no tinted gradient.
  appFooter: "w-full bg-transparent dark:bg-transparent",
  appFooterInner:
    "mx-auto flex w-full max-w-7xl flex-col items-center gap-3 px-4 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-6 sm:pb-4 md:pl-1 md:pr-[60px]",
  // Horizontal insets are symmetric on mobile (no sidebar); at md+ the left
  // inset tightens toward the rail and the right inset widens so the content
  // doesn't read as pushed against the right edge. Keep this in sync with the
  // header inner row in AppHeader so the breadcrumb and page H1 stay aligned.
  contentWrapper: "mx-auto w-full max-w-7xl flex-1 px-4 pb-6 sm:px-6 md:pl-1 md:pr-[60px]",
  tabNav: "flex gap-6 border-b border-slate-200/50 dark:border-slate-800/50",
  // Inline primary nav inside the desktop header bar (merged header+tabs).
  navBarNav: "flex items-center gap-6 lg:gap-8",
  // ── Desktop left sidebar (md+) ───────────────────────────────────────────────
  // Transparent rail (design 2a) — sits directly on the page canvas, no border.
  sidebar: "sticky top-0 hidden h-screen w-[248px] shrink-0 flex-col md:flex",
  sidebarBrandRow: "flex h-16 shrink-0 items-center gap-2.5 px-4",
  sidebarBrand:
    "flex items-center gap-2.5 rounded-xl no-underline focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40",
  sidebarBrandTile:
    "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-950/40",
  sidebarBrandWordmark:
    "text-lg font-semibold uppercase tracking-[0.16em] text-blue-700 dark:text-blue-300",
  sidebarBody: "flex min-h-0 flex-1 flex-col px-3.5 pb-4",
  sidebarSectionLabel:
    "mx-1.5 mb-2 mt-1 text-[10.5px] font-semibold uppercase tracking-[0.13em] text-slate-400 dark:text-slate-500",
  sidebarNav: "flex flex-col gap-1",
  // Static (non-route) sidebar row, e.g. the Settings button — inactive item look.
  sidebarNavButton:
    "group flex w-full items-center gap-3 rounded-r-[10px] border-l-[3px] border-transparent px-3 py-2.5 text-left text-[13.5px] font-medium text-slate-600 transition hover:bg-slate-100/70 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 dark:text-slate-300 dark:hover:bg-slate-800/40",
  // Active look for the same row (Settings while its modal is open) — mirrors the
  // sidebar nav-link active state in AppTabs so it reads identically.
  sidebarNavButtonActive:
    "group flex w-full items-center gap-3 rounded-r-[10px] border-l-[3px] border-blue-600 bg-blue-50 px-3 py-2.5 text-left text-[13.5px] font-semibold text-blue-700 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 dark:border-blue-400 dark:bg-blue-950/40 dark:text-blue-200",
  // Sidebar "Today" mini-card + account card at the foot of the rail.
  sidebarTodayCard:
    "mt-2 rounded-xl border border-[#E2E8F0] bg-[#F4F4F6] px-3 py-2.5 shadow-sm dark:border-slate-700 dark:bg-slate-900/80",
  sidebarTodayLabel:
    "text-[10px] font-semibold uppercase tracking-[0.13em] text-slate-400 dark:text-slate-500",
  sidebarTodayRow: "mt-2 flex items-center justify-between gap-2",
  sidebarTodayKey: "text-xs font-medium text-slate-500 dark:text-slate-400",
  sidebarTodayValue: "text-xs font-semibold text-slate-900 dark:text-slate-100",
  sidebarAccountCard:
    "mt-2.5 flex w-full items-center gap-2.5 rounded-xl border border-[#E2E8F0] bg-[#F4F4F6] px-2.5 py-2 text-left shadow-sm transition hover:border-slate-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 dark:border-slate-700 dark:bg-slate-900",
  sidebarAccountAvatar:
    "flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full border border-blue-200 bg-blue-50 text-xs font-bold text-blue-800 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-200",
  accountMenuDropdownUp:
    "absolute bottom-full left-0 z-50 mb-2 w-full min-w-[12rem] rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg dark:border-slate-700 dark:bg-slate-900",
  // ── Top bar (design 2a): transparent, date pill + bell (desktop), avatar (mobile) ─
  topBarDatePill:
    "hidden items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 sm:inline-flex",
  topBarIconButton:
    "relative inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300",
  topBarDivider: "hidden h-6 w-px bg-slate-200 dark:bg-slate-700 md:block",
  // ── Notifications ─────────────────────────────────────────────────────────
  // Unread dot on the bell; portaled dropdown panel + item rows.
  notificationsDot:
    "absolute right-2.5 top-2.5 h-1.5 w-1.5 rounded-full bg-amber-500 ring-2 ring-white dark:ring-slate-900",
  notificationsPanel:
    "w-80 max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900",
  notificationsPanelHeader:
    "flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-800",
  notificationsPanelTitle: "m-0 text-sm font-semibold text-slate-900 dark:text-slate-100",
  notificationsEmpty: "px-4 py-8 text-center text-sm text-slate-500 dark:text-slate-400",
  notificationsItem:
    "flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-slate-50 dark:hover:bg-slate-800/60",
  notificationsItemTitle: "m-0 text-sm font-semibold text-slate-800 dark:text-slate-100",
  notificationsItemDetail: "m-0 mt-0.5 text-xs leading-5 text-slate-500 dark:text-slate-400",
  notificationsIconAction:
    "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-300",
  notificationsIconInfo:
    "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
  // ── Account menu ──────────────────────────────────────────────────────────
  accountMenuButton:
    "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-blue-200 bg-gradient-to-br from-blue-100 to-blue-50 text-sm font-bold uppercase tracking-[0.02em] text-blue-800 shadow-sm transition hover:from-blue-200 hover:to-blue-100 hover:shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 dark:border-blue-700 dark:from-blue-900/70 dark:to-blue-950/60 dark:text-blue-100 dark:hover:from-blue-800 dark:hover:to-blue-900",
  accountMenuDropdown:
    "absolute right-0 z-50 mt-2 min-w-44 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg dark:border-slate-700 dark:bg-slate-900",
  accountMenuItem:
    "flex w-full items-center gap-2.5 whitespace-nowrap rounded-lg px-2.5 py-2 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800",
  accountMenuItemDestructive:
    "flex w-full items-center gap-2.5 whitespace-nowrap rounded-lg px-2.5 py-2 text-left text-sm font-medium text-red-600 transition hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30",
  // ── Modal ─────────────────────────────────────────────────────────────────
  modalBackdrop:
    "fixed inset-0 z-50 flex items-end justify-center bg-slate-950/60 p-0 backdrop-blur-[4px] sm:items-center sm:p-3",
  modalSurface:
    "animate-slide-up motion-reduce:animate-none sm:animate-none max-h-[82vh] w-full overflow-y-auto rounded-t-3xl border border-slate-200 bg-white p-4 shadow-2xl dark:border-slate-700 dark:bg-slate-900 sm:max-h-[92vh] sm:max-w-xl sm:rounded-2xl sm:p-5",
  legalDocumentModalSurface:
    "max-h-[88vh] w-full overflow-hidden rounded-t-3xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900 sm:max-w-4xl sm:rounded-2xl",
  legalDocumentModalHeader:
    "flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-700 sm:px-5",
  legalDocumentModalTitle: "m-0 text-sm font-semibold text-slate-900 dark:text-slate-100",
  legalDocumentModalCloseButton:
    "inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200",
  legalDocumentModalBody: "max-h-[calc(88vh-3.5rem)] overflow-y-auto px-4 pb-4 sm:px-5 sm:pb-5",
  confirmDialogSurface:
    "animate-slide-up motion-reduce:animate-none sm:animate-none w-full rounded-t-3xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-700 dark:bg-slate-900 sm:max-w-sm sm:rounded-2xl",
  confirmDialogTitle: "m-0 mb-1 text-base font-semibold text-slate-900 dark:text-slate-100",
  confirmDialogMessage: "m-0 mb-5 text-sm text-slate-600 dark:text-slate-300",
  destructiveButton:
    "rounded-xl bg-red-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60",
  // ── Scroll-to-top button ──────────────────────────────────────────────────
  scrollToTopButton:
    "fixed bottom-[calc(5.75rem+env(safe-area-inset-bottom))] right-4 z-40 flex h-10 w-10 items-center justify-center rounded-full border border-slate-300 bg-white/90 shadow-md backdrop-blur transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900/90 dark:hover:bg-slate-800 sm:bottom-[calc(1.5rem+env(safe-area-inset-bottom))] lg:bottom-6 lg:left-[calc(50%+36rem+0.75rem)] lg:right-auto",

  // ── Page / section shells ──────────────────────────────────────────────────
  page: "mt-2 w-full sm:mt-3",
  section:
    "rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6 md:p-8",
  // Input panel (collapsible cards inside forms)
  panel:
    "grid gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-4",

  // ── Surface cards ──────────────────────────────────────────────────────────
  surfaceCard: "rounded-3xl bg-white p-3 shadow-sm dark:bg-slate-900 sm:p-5",

  // ── Typography tokens ──────────────────────────────────────────────────────
  pageTitle: "m-0 text-2xl font-semibold text-slate-900 dark:text-slate-100",
  sectionTitle: "m-0 text-xl font-semibold text-slate-900 dark:text-slate-100",
  sectionHeader: "mb-3 grid gap-2 sm:mb-4 sm:gap-3",
  cardHeader: "mb-2 grid gap-1 sm:mb-3",
  cardTitle: "m-0 text-base font-semibold text-slate-900 dark:text-slate-100 sm:text-lg",
  cardDescription: "m-0 text-sm text-slate-600 dark:text-slate-300",
  recurrenceLabel: "text-xs font-semibold text-slate-700 dark:text-slate-300",
  recurrenceValue: "m-0 text-xs text-slate-500 dark:text-slate-400",

  // ── Form layout ────────────────────────────────────────────────────────────
  form: "grid gap-2.5 sm:gap-3",

  // ── Auth layout + form primitives ──────────────────────────────────────────
  authViewport: "mx-auto flex min-h-[calc(100vh-16rem)] w-full max-w-xl items-center py-6 sm:py-10",
  authCard:
    "w-full rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6",
  authSegmentedControl: "flex w-full rounded-lg bg-slate-100 p-1 dark:bg-slate-800",
  authSegmentedButton:
    "flex-1 rounded-md px-3 py-2 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50",
  authSegmentedButtonActive:
    "bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-slate-100",
  authSegmentedButtonInactive:
    "text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white",
  authHeading: "m-0 mt-6 text-2xl font-semibold text-slate-900 dark:text-slate-100",
  authDescription: "m-0 mt-3 text-sm text-slate-600 dark:text-slate-300",
  authForm: "mt-6 grid gap-4",
  authLabel: "grid gap-1 text-sm font-semibold text-slate-800 dark:text-slate-200",
  authInput:
    "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition hover:border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100",
  authPrimaryButton:
    "mt-5 w-full rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60",
  authHelperRow:
    "mt-3 flex items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400",
  authHelperLink:
    "text-xs font-medium text-blue-600 underline-offset-2 transition hover:underline dark:text-blue-300",
  authHelperButton:
    "text-xs font-medium text-blue-600 underline-offset-2 transition hover:underline dark:text-blue-300",
  onboardingSetupViewport:
    "mx-auto flex min-h-[calc(100vh-16rem)] w-full max-w-7xl items-start py-6 sm:py-10",
  onboardingSetupCard:
    "w-full rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6",
  onboardingRequiredBadge:
    "ml-2 rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700 dark:bg-red-950/40 dark:text-red-300",
  onboardingSectionLabel:
    "m-0 text-xs font-semibold uppercase tracking-[0.16em] text-blue-700 dark:text-blue-300",
  onboardingTitle: "m-0 mt-2 text-2xl font-semibold text-slate-900 dark:text-slate-100",
  onboardingSubtitle: "m-0 mt-2 text-sm text-slate-600 dark:text-slate-300",
  onboardingProgressTrack: "mt-4 h-2 w-full rounded-full bg-slate-200 dark:bg-slate-700",
  onboardingProgressFill: "h-2 rounded-full bg-blue-600 transition-all",
  onboardingErrorBanner:
    "m-0 mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-800/60 dark:bg-rose-900/20 dark:text-rose-200",
  onboardingPrimaryButton:
    "inline-flex w-fit items-center rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60",
  onboardingFieldLabel: "grid gap-1 text-sm text-slate-700 dark:text-slate-200",
  onboardingRadioLabel: "flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200",
  onboardingTimeInput:
    "rounded-lg border border-slate-300 px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-950",
  onboardingBreakToggleButton:
    "inline-flex h-5 w-5 items-center justify-center rounded-full border border-blue-300 text-xs font-semibold text-blue-600 transition hover:bg-blue-50 dark:border-blue-700 dark:text-blue-300 dark:hover:bg-blue-950/30",
  onboardingBreakInput:
    "w-24 rounded-lg border border-slate-300 px-2 py-1 text-sm disabled:cursor-not-allowed disabled:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:disabled:bg-slate-800",
  onboardingObjectiveFieldset:
    "grid gap-3 rounded-xl border border-slate-200 p-4 dark:border-slate-700",

  // ── Input ─────────────────────────────────────────────────────────────────
  // bg-white · border-slate-200 · hover:border-slate-300 · focus:ring-blue-100
  searchInput:
    "w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition hover:border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 sm:px-4 sm:py-3",
  searchInputCompact:
    "w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition hover:border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 sm:px-4 sm:py-1.5",
  recurrenceInput:
    "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition hover:border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100",
  dateInput:
    "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition hover:border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100",
  dateInputTrigger:
    "flex items-center gap-2 rounded-xl border border-blue-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-1 ring-blue-100 transition hover:border-blue-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-blue-800 dark:bg-slate-900 dark:text-slate-100 dark:ring-blue-900/40 cursor-pointer",
  dateInputTriggerCompact:
    "flex shrink-0 items-center gap-2.5 rounded-xl border border-blue-200 bg-white px-4 py-2.5 text-sm outline-none transition hover:border-blue-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-blue-800 dark:bg-slate-900 cursor-pointer",
  calendarPopover:
    "absolute z-50 mt-1 rounded-xl border border-slate-200 bg-white p-3 shadow-md dark:border-slate-700 dark:bg-slate-900",
  calendarNav: "flex items-center justify-between pb-2",
  calendarNavButton:
    "inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200",
  calendarMonthLabel: "text-sm font-semibold text-slate-900 dark:text-slate-100",
  calendarGrid: "text-sm",
  calendarHeadCell: "w-9 pb-1 text-center text-xs font-medium text-slate-400 dark:text-slate-500",
  calendarDayBase: "inline-flex h-9 w-9 items-center justify-center rounded-lg text-sm transition",
  calendarDayDefault:
    "text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800",
  calendarDaySelected: "bg-blue-600 font-semibold text-white hover:bg-blue-700",
  calendarDayToday: "font-semibold text-blue-600 dark:text-blue-400",
  calendarDayDisabled: "text-slate-300 cursor-not-allowed dark:text-slate-600",
  calendarFooter:
    "mt-2 flex items-center justify-end border-t border-slate-100 pt-2 dark:border-slate-800",
  calendarFooterLink:
    "text-xs font-medium text-blue-600 hover:text-blue-700 cursor-pointer dark:text-blue-400 dark:hover:text-blue-300",

  // ── Buttons ───────────────────────────────────────────────────────────────
  // Primary: bg-blue-600 text-white hover:bg-blue-700
  primaryButton:
    "w-full rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto sm:py-1.5",
  // Secondary: bg-slate-100 text-slate-700 hover:bg-slate-200  (no border)
  secondaryButton:
    "w-full rounded-xl bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 sm:w-auto sm:py-1.5",

  // ── Mobile step nav ────────────────────────────────────────────────────────
  stickyFooter:
    "sticky bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-30 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-lg backdrop-blur dark:border-slate-700 dark:bg-slate-900/95 sm:bottom-3",

  // ── Patient selection two-column layout ────────────────────────────────────
  patientSelectionGrid: "grid grid-cols-1 gap-4 md:grid-cols-2 md:items-start",
  patientColumnLabel:
    "m-0 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400",
  patientSearchContainer:
    "flex min-h-0 flex-col gap-2 px-0 pt-1 max-h-72 md:max-h-none md:h-[26rem]",
  secondaryIconButton:
    "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700",
  // '+ Add' button beside the client search — outline style to pair with the bordered search input
  addClientButton:
    "inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900 sm:py-1.5",

  // ── Selectable list (patient search results) ───────────────────────────────
  selectableList: "m-0 min-h-0 flex-1 list-none space-y-2 overflow-y-auto p-0",
  selectableItemButton:
    "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-left text-sm transition hover:bg-slate-50 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-950 dark:hover:bg-slate-900",

  // ── Action rows ────────────────────────────────────────────────────────────
  actionRow: "flex justify-end",
  actionButtons: "flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center",

  // ── Destination list ───────────────────────────────────────────────────────
  destinationList: "overflow-y-auto pb-1 pl-4 pr-1 pt-2 md:h-[26rem]",
  // 'Your route' column (desktop): subtle gray canvas + vertical separator from the search column
  selectedRouteColumn:
    "min-w-0 md:border-l md:border-slate-200 md:bg-slate-50/60 md:pl-4 dark:md:border-slate-800 dark:md:bg-slate-900/30",
  selectedListClearButton:
    "inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-slate-100 px-2.5 text-xs font-medium text-slate-600 transition hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-red-950/30 dark:hover:text-red-400",
  destinationItem:
    "flex flex-col gap-2.5 text-sm text-slate-900 dark:text-slate-200 md:flex-row md:items-start md:justify-between md:gap-3",
  destinationItemBody: "flex min-w-0 flex-1 items-start gap-2.5 sm:gap-3",
  destinationDetailsToggle:
    "w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 sm:w-auto",
  destinationRemove:
    "w-full rounded-lg border border-red-200 px-2 py-1.5 text-xs font-medium text-red-700 transition hover:bg-red-50 dark:border-red-900/60 dark:text-red-300 dark:hover:bg-red-950/30 sm:w-auto sm:self-start sm:py-1",
  // Selected-list row actions — bordered icon buttons (edit pencil + delete trash), paired per Figma
  destinationEditIcon:
    "inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-slate-700 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800",
  destinationRemoveIcon:
    "inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-400 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 dark:border-slate-700 dark:text-slate-500 dark:hover:bg-red-950/30 dark:hover:text-red-400",
  destinationNameButton:
    "block w-full truncate text-left text-sm font-semibold text-slate-900 transition hover:text-blue-600 dark:text-slate-100 dark:hover:text-blue-300",
  destinationPopover:
    "absolute left-0 top-full z-20 mt-1.5 min-w-52 rounded-xl border border-slate-200 bg-white p-3 shadow-lg dark:border-slate-700 dark:bg-slate-900",
  infoModalHeader: "mb-4 flex items-start justify-between gap-3",
  infoModalBody: "grid gap-3",
  infoModalCloseButton:
    "shrink-0 rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300",
  infoModalSectionLabel:
    "m-0 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400",
  infoModalSectionValue: "m-0 mt-1 text-sm text-slate-800 dark:text-slate-100",
  infoModalSectionValueInline: "m-0 text-sm text-slate-800 dark:text-slate-100",
  footerRow: "mt-1 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between",

  // ── Status pills ───────────────────────────────────────────────────────────
  // Fixed    → bg-blue-100 text-blue-700
  // Flexible → bg-emerald-100 text-emerald-700  (see renderVisitTypePill in PatientsTable)
  visitTypePillBase:
    "inline-flex w-fit justify-self-start rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
  visitTypePillFixed: "bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-200",
  visitTypePillFlexible:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-200",
  visitTypePillMixed: "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-200",
  countPill:
    "rounded-full bg-blue-50 px-3 py-0.5 text-xs font-bold text-blue-600 dark:bg-blue-950/40 dark:text-blue-300 sm:text-sm",

  // ── Optimize CTA ──────────────────────────────────────────────────────────
  optimizeButton:
    "inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 disabled:hover:bg-slate-300 dark:disabled:bg-blue-950/70 dark:disabled:text-slate-400 dark:disabled:hover:bg-blue-950/70 sm:w-auto",

  // ── Muted panel ───────────────────────────────────────────────────────────
  panelMuted:
    "rounded-2xl border border-slate-200 bg-white px-3 py-5 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400 sm:px-4 sm:py-6",

  // ── Result / Dispatch Plan ─────────────────────────────────────────────────
  resultHeader: "flex flex-col gap-2",
  resultCtaStack:
    "mt-2 flex w-full flex-wrap items-center gap-2.5 sm:mt-3 sm:gap-3 lg:ml-auto lg:w-auto lg:items-end lg:justify-end lg:text-right",
  googleMapsButton:
    "inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700 sm:w-auto",
  resultInfoNote:
    "inline-flex w-full items-start gap-2 rounded-xl border border-slate-200/90 bg-slate-100/80 px-3 py-2 text-left text-xs text-slate-600 dark:border-slate-700/80 dark:bg-slate-900/50 dark:text-slate-400",

  // ── Metric cards (Route Planner Dispatch Plan) ─────────────────────────────
  // label: text-xs text-slate-500   value: text-lg font-semibold text-slate-900
  resultStatsGrid: "mt-4 grid w-full gap-3 sm:grid-cols-2",
  resultStatCard:
    "route-result-stat-card rounded-xl border border-slate-200 bg-white px-3 py-3 shadow-sm transition hover:shadow dark:border-slate-700/80 dark:bg-slate-950/60 sm:px-3 sm:py-3",
  resultStatLabel: "text-xs font-medium text-slate-500 dark:text-slate-400",
  resultStatValue:
    "mt-0.5 text-[0.95rem] font-semibold tracking-tight text-slate-900 dark:text-slate-100 sm:text-lg",
  resultStatMeta: "mt-0.5 text-xs text-slate-500 dark:text-slate-400 sm:text-sm",
  resultStatCardFlash: "motion-reduce:animate-none",
  resultEndpoints:
    "mt-4 grid gap-3 rounded-2xl bg-slate-100/80 p-3 dark:bg-slate-900/55 sm:grid-cols-2",
  resultEndpointCard:
    "rounded-xl border border-slate-200/90 bg-white/85 px-3 py-3 dark:border-slate-700/80 dark:bg-slate-950/60",
  resultEndpointLabel:
    "text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400",
  resultEndpointValue: "mt-1 text-sm font-medium leading-6 text-slate-800 dark:text-slate-100",

  // ── Map ───────────────────────────────────────────────────────────────────
  map: "h-56 w-full overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 sm:h-[min(70vh,600px)] sm:min-h-64",

  // ── Panel chevron / inline edit ─────────────────────────────────────────────
  panelChevronButton:
    "inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-300",
  inlineEditLink: "text-blue-600 underline-offset-2 hover:underline dark:text-blue-300",
  collapsedPreviewButton:
    "inline rounded bg-transparent p-0 text-sm font-medium text-blue-600 underline-offset-2 transition hover:underline dark:text-blue-300",

  // ── Warning / alert banners ──────────────────────────────────────────────────
  warningBannerAmber:
    "rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 dark:border-amber-900/70 dark:bg-amber-950/40",
  warningBannerTitle: "m-0 text-sm font-semibold text-amber-900 dark:text-amber-200",
  warningBannerDescription: "m-0 text-xs text-amber-800 dark:text-amber-300",
  warningBannerButton:
    "rounded-lg border border-amber-300 px-2.5 py-1.5 text-xs font-semibold text-amber-900 transition hover:bg-amber-100 dark:border-amber-800 dark:text-amber-200 dark:hover:bg-amber-900/40",
  formWarningBanner:
    "mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900/70 dark:bg-amber-950/40 dark:text-amber-300",
  formErrorBanner:
    "mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/70 dark:bg-red-950/40 dark:text-red-300",
  inlineErrorBanner:
    "m-0 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/70 dark:bg-red-950/40 dark:text-red-300",
  inlineSuccessBanner:
    "m-0 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/40 dark:text-emerald-300",

  // ── Mobile planner ───────────────────────────────────────────────────────────
  mobileContinueHint: "m-0 mb-2 text-center text-xs text-slate-500 dark:text-slate-400",

  // ── Optimization objective selector ─────────────────────────────────────────
  objectiveSelectorGroup: "flex gap-3 sm:gap-4",
  objectiveSelectorOption:
    "flex flex-1 cursor-pointer items-start gap-2.5 rounded-xl border border-slate-200 px-3 py-2.5 transition hover:border-slate-300 has-[:checked]:border-blue-400 has-[:checked]:bg-blue-50/80 dark:border-slate-700 dark:hover:border-slate-600 dark:has-[:checked]:border-blue-600 dark:has-[:checked]:bg-blue-900/25",
  objectiveSelectorLabel: "text-xs font-semibold text-slate-800 dark:text-slate-100",
  objectiveSelectorDescription: "mt-0.5 text-xs text-slate-500 dark:text-slate-400",
  segmentedControlContainer:
    "flex w-full rounded-lg bg-slate-100 p-1 dark:bg-slate-800 sm:inline-flex sm:w-auto",
  segmentedControlButtonBase:
    "inline-flex flex-1 items-center justify-center rounded-md px-2.5 py-1 text-xs transition sm:flex-none",
  segmentedControlButtonActive:
    "bg-white text-slate-900 shadow-sm font-semibold dark:bg-slate-900 dark:text-slate-100",
  segmentedControlButtonInactive:
    "text-slate-600 hover:text-slate-800 dark:text-slate-300 dark:hover:text-slate-100",

  // ── Submit / optimize ────────────────────────────────────────────────────────
  spinnerWhite: "h-4 w-4 animate-spin rounded-full border-2 border-white/70 border-t-white",
  visitCountPill:
    "inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  optimizeButtonLarge:
    "optimize-route-button inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 disabled:hover:bg-slate-300 dark:disabled:bg-blue-950/70 dark:disabled:text-slate-400 dark:disabled:hover:bg-blue-950/70 sm:w-auto",
  routeSkeletonSection: "mt-6 border-t border-slate-200 pt-6 dark:border-slate-800",
  routeSkeletonDispatch:
    "flex flex-col gap-4 rounded-2xl border border-slate-200 bg-gradient-to-br from-white via-slate-50 to-blue-50/70 p-3 dark:border-slate-800 dark:from-slate-900 dark:via-slate-900 dark:to-blue-950/20 sm:rounded-[28px] sm:p-4",
  routeSkeletonHeader: "flex flex-col gap-3",
  routeSkeletonTimelineMap:
    "mt-5 flex flex-col gap-4 xl:grid xl:grid-cols-[minmax(0,0.9fr)_minmax(22rem,1.1fr)]",
  routeSkeletonCard:
    "rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:rounded-[28px] sm:p-4",
  routeSkeletonStatsGrid: "grid grid-cols-2 gap-2 xl:grid-cols-4",
  routeSkeletonSplitHeader: "flex items-start justify-between gap-3",
  routeSkeletonCardHeader: "flex flex-col gap-2",
  routeSkeletonTimelineList: "mt-4 flex flex-col gap-3",
  routeSkeletonMapStack: "mt-4 flex flex-col gap-3",
  routeSkeletonPulse:
    "route-loading-skeleton motion-reduce:animate-none rounded-xl bg-slate-200/80 dark:bg-slate-700/70",
  bootstrapFallbackPage: "mt-3 grid gap-4 sm:gap-5",
  bootstrapFallbackCard:
    "rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-5",
  bootstrapFallbackSpinner:
    "mt-0.5 inline-flex h-5 w-5 animate-spin items-center justify-center text-blue-600 dark:text-blue-300",
  bootstrapFallbackTitle: "m-0 text-sm font-semibold text-slate-900 dark:text-slate-100",
  bootstrapFallbackSubtitle: "m-0 mt-1 text-sm text-slate-600 dark:text-slate-300",
  routeSkeletonTitle: "h-3.5 w-28",
  routeSkeletonHeading: "h-7 w-52",
  routeSkeletonBody: "h-4 w-full max-w-2xl",
  routeSkeletonBodyShort: "h-4 w-2/3",
  routeSkeletonWarning: "h-20 w-full",
  routeSkeletonStat: "h-28 w-full",
  routeSkeletonTimelineHeader: "h-6 w-36",
  routeSkeletonTimelineAction: "h-8 w-28",
  routeSkeletonTimelineItem: "h-24 w-full",
  routeSkeletonMapAction: "h-10 w-full",
  routeSkeletonMapNote: "h-4 w-44",
  routeSkeletonMapCanvas: "h-56 w-full sm:h-[min(70vh,600px)] sm:min-h-64",
  // Progress affordance shown inside the skeleton while the optimize request runs.
  routeSkeletonStatusRow: "flex items-center gap-2",
  routeSkeletonStatusText: "text-sm font-medium text-slate-600 dark:text-slate-300",
  routeSkeletonSpinner:
    "inline-flex h-4 w-4 shrink-0 animate-spin items-center justify-center text-blue-600 motion-reduce:animate-none dark:text-blue-300",
  routeSkeletonProgressTrack:
    "mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-200/80 dark:bg-slate-700/70",
  routeSkeletonProgressBar:
    "h-full rounded-full bg-blue-600 transition-[width] duration-500 ease-out dark:bg-blue-500",
  // Re-optimize: keep the prior result visible but dimmed, with a floating badge,
  // instead of flashing back to the skeleton.
  routeReoptimizeWrap: "relative",
  routeReoptimizeDimmed: "pointer-events-none opacity-30 transition-opacity",
  // Sticky at the top of the result, just below the app header, so it hugs the
  // route yet stays in view while the user scrolls during the ~4-5s re-optimize.
  routeReoptimizeOverlay: "pointer-events-none sticky top-16 z-30 flex justify-center pt-2",
  routeReoptimizeBadge:
    "inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/95 px-4 py-2 text-sm font-semibold text-slate-700 shadow-md backdrop-blur-sm dark:border-slate-700 dark:bg-slate-900/95 dark:text-slate-200",

  // ── Visit window form ────────────────────────────────────────────────────────
  visitWindowCheckboxLabel:
    "mt-2 inline-flex items-start gap-2 text-xs leading-snug text-slate-600 dark:text-slate-300",
  timeInput:
    "w-full rounded-lg border border-slate-300 px-2 py-1 text-xs text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100",

  // ── Destination list extras ──────────────────────────────────────────────────
  destinationIndex: "w-6 shrink-0 text-sm font-semibold text-slate-500 dark:text-slate-400",
  panelEmptyText: "m-0 text-sm text-slate-500 dark:text-slate-400",

  // ── Working hours schedule editor ─────────────────────────────────────────────
  scheduleEditorRow:
    "grid grid-cols-[3.75rem_1fr] items-start gap-x-2.5 gap-y-1 border-b border-slate-100 py-3.5 last:border-0 dark:border-slate-800 sm:grid-cols-[4.25rem_1fr]",
  scheduleEditorDayLabel: "pt-1 text-sm font-semibold text-slate-700 dark:text-slate-300",
  scheduleEditorFields: "grid grid-cols-[auto_1fr] items-center gap-1.5 sm:gap-2",
  scheduleEditorTimeRange: "flex items-center gap-1.5 sm:gap-2",
  scheduleEditorLunchFields: "flex items-center gap-2",
  scheduleEditorTimeInput:
    "w-28 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-sm font-medium tabular-nums text-slate-900 outline-none transition hover:border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 sm:w-36",
  scheduleEditorLunchRow:
    "mt-1.5 flex flex-wrap items-center gap-2 pl-0 text-sm text-slate-600 dark:text-slate-400",
  scheduleEditorLunchInput:
    "w-20 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-sm font-medium tabular-nums text-slate-900 outline-none transition hover:border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100",
  scheduleEditorToggle:
    "h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 dark:border-slate-600",
  scheduleThresholdInput:
    "w-20 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-sm font-medium tabular-nums text-slate-900 outline-none transition hover:border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100",

  // ── Dashboard ────────────────────────────────────────────────────────────────
  dashboardCard:
    "dashboard-reveal rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-5",
  dashboardHeroSection:
    "dashboard-surface dashboard-reveal relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6",
  dashboardEyebrow:
    "m-0 text-[11px] font-medium uppercase tracking-[0.18em] text-blue-700 dark:text-blue-300",
  dashboardHeroHeading:
    "m-0 mt-2 text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-100 sm:text-[2.1rem]",
  dashboardHeroMeta: "m-0 mt-2 text-sm font-medium text-slate-500 dark:text-slate-400 sm:text-base",
  dashboardHeroBody: "m-0 mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300 sm:text-base",
  dashboardHeroActions: "mt-6 flex flex-wrap gap-2.5",
  dashboardKpiGrid: "dashboard-reveal grid gap-3 sm:grid-cols-2 xl:grid-cols-4",
  dashboardKpiCard:
    "dashboard-reveal dashboard-kpi-card block rounded-2xl border border-[#E2E8F0] bg-[#F4F4F6] p-4 shadow-sm transition hover:border-slate-300 hover:shadow dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700 sm:p-5",
  dashboardKpiLabel:
    "m-0 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400",
  dashboardKpiValue: "m-0 mt-2 text-2xl font-semibold text-slate-900 dark:text-slate-100",
  dashboardKpiDelta: "m-0 mt-2 text-xs font-semibold",
  dashboardKpiProgressTrack: "mt-3 h-2 rounded-full bg-slate-200 dark:bg-slate-700",
  dashboardKpiProgressFill:
    "dashboard-kpi-progress-fill h-full rounded-full bg-gradient-to-r from-cyan-500 to-blue-600",
  // Clients page lifecycle tabs (Active / Idle / Archived)
  // Row holding the lifecycle tabs (left) + the info popover trigger (right).
  clientTabsRow: "relative mb-4 flex border-b border-slate-200 dark:border-slate-800",
  // overflow-x-auto alone promotes overflow-y (visible) to auto per spec, which
  // shows a stray vertical scrollbar over the last tab. Pin overflow-y and hide
  // the scrollbar chrome (horizontal scroll still works for narrow screens).
  clientStateTabBar:
    "flex gap-1 overflow-x-auto overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
  clientStateTab:
    "-mb-px shrink-0 whitespace-nowrap border-b-2 px-3 py-2 text-sm font-semibold transition",
  clientStateTabActive: "border-blue-600 text-blue-700 dark:border-blue-400 dark:text-blue-300",
  clientStateTabInactive:
    "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200",
  // Per-tab helper line (icon + subtitle) under the lifecycle tabs.
  clientTabHelper:
    "mb-4 flex items-start gap-2 text-[13px] leading-relaxed text-slate-500 dark:text-slate-400",
  clientTabHelperIcon: "mt-px h-4 w-4 shrink-0 text-slate-400 dark:text-slate-500",
  // Info (ⓘ) trigger at the right of the tab row + its privacy-reminder popover.
  clientTabInfoButton:
    "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-blue-300 text-xs font-semibold text-blue-600 transition hover:bg-blue-50 dark:border-blue-700 dark:text-blue-300 dark:hover:bg-blue-950/30",
  infoPopover:
    "absolute right-0 top-full z-20 mt-2 w-72 max-w-[calc(100vw-3rem)] rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-[13px] leading-relaxed text-slate-600 shadow-lg dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300",
  // Clients page summary stats row (desktop only — hidden below md)
  // Active tab: one-line summary strip (replaces the four stat boxes).
  // Tightened: a light borderless summary line (no filled band) so it reads as
  // part of the table group rather than a separate card.
  clientStatsStrip:
    "mb-4 hidden flex-wrap items-center gap-x-3.5 gap-y-1.5 px-0.5 py-1 text-[13px] font-medium text-slate-500 dark:text-slate-400 md:flex",
  clientStatsStripDot: "h-1 w-1 rounded-full bg-slate-300 dark:bg-slate-600",
  clientStatsStripValue: "font-bold text-slate-900 dark:text-slate-100",
  clientStatsStripValueFixed: "font-bold text-blue-800 dark:text-blue-300",
  clientStatsStripValueFlexible: "font-bold text-emerald-700 dark:text-emerald-300",
  // ── Clients page: title count, window filter, table avatar + repeat ──────────
  clientsTitleCount: "font-semibold text-slate-400 dark:text-slate-500",
  clientAvatar:
    "flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold uppercase text-blue-700 dark:bg-blue-950/50 dark:text-blue-200",
  repeatIconActive: "h-5 w-5 text-blue-600 dark:text-blue-300",
  repeatIconMuted: "h-5 w-5 text-slate-300 dark:text-slate-600",
  repeatCountBadge:
    "absolute -right-1.5 -top-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-blue-600 px-1 text-[10px] font-semibold leading-none text-white dark:bg-blue-500",
  addClientMobileButton:
    "inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-blue-700",
  mobileEditButton:
    "inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold text-blue-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-blue-300 dark:hover:bg-slate-800",
  mobileDeleteButton:
    "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-400 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:opacity-50 dark:border-slate-700 dark:text-slate-500 dark:hover:bg-red-950/30 dark:hover:text-red-400",
  // Route planner: trip-setup bookend (START → N stops rail → END)
  tripBookendRow: "flex items-center gap-4",
  tripStartMarker:
    "flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300",
  tripEndMarker:
    "flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-300",
  tripStartLabel:
    "m-0 text-[11px] font-semibold uppercase tracking-[0.08em] text-emerald-600 dark:text-emerald-400",
  tripEndLabel:
    "m-0 text-[11px] font-semibold uppercase tracking-[0.08em] text-blue-700 dark:text-blue-300",
  tripAddressPrimary: "m-0 truncate text-sm font-semibold text-slate-900 dark:text-slate-100",
  tripAddressSecondary: "m-0 truncate text-xs text-slate-400 dark:text-slate-500",
  tripStopsPill:
    "inline-flex shrink-0 items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
  tripRailDashed: "h-px flex-1 border-t border-dashed border-slate-300 dark:border-slate-700",
  tripEditButton:
    "inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm font-medium text-blue-600 transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:text-blue-300 dark:hover:bg-slate-800",
  // Route planner: client search list cards (left column)
  routeClientCard:
    "flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-left transition hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700",
  routeClientCardSelected:
    "border-blue-200 bg-blue-50/60 hover:border-blue-300 dark:border-blue-900 dark:bg-blue-950/30",
  routeClientName: "m-0 truncate text-sm font-semibold text-slate-900 dark:text-slate-100",
  routeClientAddress: "m-0 truncate text-xs text-slate-500 dark:text-slate-400",
  // Skeleton placeholder for the client search list — mirrors routeClientCard's
  // footprint so results swap in without any layout jump.
  routeClientSkeletonCard:
    "flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5 dark:border-slate-800 dark:bg-slate-900",
  routeClientSkeletonAvatar:
    "route-loading-skeleton motion-reduce:animate-none h-9 w-9 shrink-0 rounded-full bg-slate-200/80 dark:bg-slate-700/70",
  routeClientSkeletonLine:
    "route-loading-skeleton motion-reduce:animate-none rounded bg-slate-200/80 dark:bg-slate-700/70",
  routeClientSkeletonName: "h-3.5 w-32",
  routeClientSkeletonAddress: "mt-1.5 h-3 w-48 max-w-full",
  routeInRouteBadge:
    "inline-flex shrink-0 items-center gap-1 rounded-lg bg-blue-600 px-2.5 py-1 text-xs font-semibold text-white dark:bg-blue-500",
  routeAddClientButton:
    "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-600 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-blue-950/30 dark:hover:text-blue-300",
  // Route planner: 'Your route' timeline rail (continuous line + START/END caps)
  routeTimelineRail: "relative ml-2 mt-3 border-l-2 border-slate-200 pl-6 dark:border-slate-700",
  routeTimelineStartNode:
    "absolute -left-[33px] top-0 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 ring-4 ring-white dark:bg-emerald-950/50 dark:ring-slate-900",
  routeTimelineStartLabel:
    "m-0 text-[11px] font-semibold uppercase tracking-[0.08em] text-emerald-600 dark:text-emerald-400",
  routeWindowPill:
    "inline-flex shrink-0 items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300",
  routeTimelineEndNode:
    "absolute -left-[34px] top-1 flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-slate-500 ring-4 ring-white dark:bg-slate-800 dark:text-slate-400 dark:ring-slate-900",
  // 'Your route' selection preview: blue rail line (no top margin — aligns START with the search input)
  selectedTimelineRail:
    "relative ml-2 space-y-3 border-l-2 border-blue-600 pl-6 dark:border-blue-500",
  // 'Your route' selection preview: numbered node circle on the rail (one per client)
  selectedTimelineNode:
    "absolute -left-[39px] top-2 flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white ring-1 ring-blue-200 ring-offset-4 ring-offset-white dark:bg-blue-500 dark:ring-blue-800 dark:ring-offset-slate-900",
  // START/END caps reuse the trip-setup markers (green target / blue flag), with a border
  selectedTimelineStartNode:
    "absolute -left-[37px] top-0 flex h-7 w-7 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200 ring-offset-4 ring-offset-white dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-800 dark:ring-offset-slate-900",
  selectedTimelineEndNode:
    "absolute -left-[37px] top-0 flex h-7 w-7 items-center justify-center rounded-full bg-blue-50 text-blue-600 ring-1 ring-blue-200 ring-offset-4 ring-offset-white dark:bg-blue-950/40 dark:text-blue-300 dark:ring-blue-800 dark:ring-offset-slate-900",
  // Route planner: stale-route actions, folded into the timeline header (shown only when manually reordered)
  routeRecalculateButton:
    "inline-flex items-center gap-1.5 whitespace-nowrap rounded-xl bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-blue-500 dark:hover:bg-blue-600",
  routeResetButton:
    "inline-flex items-center gap-1 whitespace-nowrap rounded-xl px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-800 dark:text-slate-300 dark:hover:bg-slate-800",
  // Route Advisor (AI) — blue-tinted selected/active card (§11), lives under the
  // schedule summary. One card surface, no stacked shadows.
  routeAdvisorCard:
    "mb-4 rounded-xl border border-blue-200 bg-blue-50/50 px-4 py-3 dark:border-blue-900/60 dark:bg-blue-950/20",
  routeAdvisorHeader: "flex items-center justify-between gap-3",
  routeAdvisorEyebrow:
    "m-0 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-blue-700 dark:text-blue-300",
  routeAdvisorButton:
    "inline-flex items-center gap-1.5 whitespace-nowrap rounded-xl bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-blue-500 dark:hover:bg-blue-600",
  routeAdvisorBrief: "m-0 mt-2 text-sm leading-6 text-slate-700 dark:text-slate-200",
  routeAdvisorSuggestionList: "m-0 mt-2 flex list-none flex-col gap-1.5 p-0",
  routeAdvisorSuggestion:
    "flex items-start gap-2 text-sm leading-6 text-slate-700 dark:text-slate-200",
  routeAdvisorSkeletonLine: "h-3.5 rounded-full bg-blue-100/80 dark:bg-blue-900/40",
  routeAdvisorError: "m-0 mt-2 text-xs text-slate-500 dark:text-slate-400",
  routeAdvisorDisclaimer: "m-0 mt-2.5 text-[0.7rem] leading-4 text-slate-400 dark:text-slate-500",
  dashboardNudgeCard:
    "dashboard-reveal rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-sm dark:border-amber-900/70 dark:bg-amber-950/35 sm:p-5",
  dashboardAlertItem:
    "rounded-xl border border-slate-200 bg-slate-50/80 p-3 dark:border-slate-700 dark:bg-slate-800/70",
  dashboardScheduleItem:
    "flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-3 dark:border-slate-700",
  dashboardStatusPill:
    "rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  dashboardDraftActions: "mt-4 flex flex-wrap gap-2",
  dashboardTrendRow: "grid grid-cols-[40px_1fr_36px] items-center gap-2",
  dashboardTrendTrack: "h-2 rounded-full bg-slate-200 dark:bg-slate-700",
  dashboardTrendFill:
    "dashboard-trend-fill h-full rounded-full bg-gradient-to-r from-cyan-500 to-blue-600",
  dashboardSnapshotGrid:
    "mt-3 grid gap-2 text-sm text-slate-600 dark:text-slate-300 sm:grid-cols-3",
  dashboardSnapshotItem: "m-0 rounded-xl bg-slate-100 p-3 dark:bg-slate-800/80",
  dashboardRiskItem:
    "flex items-start justify-between gap-3 rounded-xl border border-slate-200 p-3 dark:border-slate-700",
  dashboardRiskBadgeAmber:
    "rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  dashboardRiskBadgeRose:
    "rounded-full bg-rose-100 px-2.5 py-1 text-xs font-semibold text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",

  // ── Form fields ────────────────────────────────────────────────────────────
  formLabel: "text-sm font-semibold text-slate-800 dark:text-slate-200",
  formInput:
    "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition hover:border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100",
  formSelect:
    "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition hover:border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 cursor-pointer",
  requiredAsterisk: "text-red-500 dark:text-red-400",
  // Nested form sections read as soft groups (slate fill + caps eyebrow), not heavy cards.
  formGroupSection:
    "grid gap-3 rounded-2xl border border-slate-100 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-800/30",
  formGroupEyebrow:
    "m-0 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400",
  // Footer pinned to the bottom of the scrolling modal surface on all breakpoints.
  modalStickyFooter:
    "sticky bottom-0 z-10 -mx-5 mt-1 flex flex-col-reverse gap-3 border-t border-slate-200 bg-white/95 px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95 sm:-mx-6 sm:flex-row sm:justify-end sm:px-6 sm:pb-4",

  // ── Tables ────────────────────────────────────────────────────────────────
  tableCard:
    "overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900",
  tableRow: "group transition hover:bg-slate-50 dark:hover:bg-slate-800/40",
  // Selected row (idle bulk-select) — blue selection surface per design-system §11.
  tableRowSelected: "bg-blue-50/60 dark:bg-blue-950/30",
  // Row / select-all checkbox.
  tableSelectCheckbox:
    "h-[18px] w-[18px] cursor-pointer rounded accent-blue-600 dark:accent-blue-500",
  // In-header bulk toolbar (idle, ≥1 selected) — amber selection bar.
  tableBulkBar: "flex items-center gap-3 bg-amber-50 px-5 py-2.5 dark:bg-amber-950/30",
  tableBulkLabel: "text-sm font-semibold text-amber-900 dark:text-amber-200",
  tableBulkDivider: "h-4 w-px bg-amber-300 dark:bg-amber-700",
  tableBulkClear:
    "text-sm font-semibold text-amber-800 underline underline-offset-2 transition hover:text-amber-900 dark:text-amber-300 dark:hover:text-amber-200",
  tableBulkArchiveButton:
    "inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-60",
  // Mobile sticky bulk-archive bar (Idle + selection).
  mobileBulkBar:
    "fixed inset-x-0 bottom-0 z-40 flex items-center gap-3 border-t border-amber-300 bg-amber-50 px-4 py-3 md:hidden dark:border-amber-700 dark:bg-amber-950/40",
  mobileBulkClearButton:
    "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-amber-300 bg-white text-amber-800 transition hover:bg-amber-100 dark:border-amber-700 dark:bg-slate-900 dark:text-amber-300",
  // Archived-tab bulk toolbar — primary (blue) variant instead of amber.
  tableBulkBarPrimary: "flex items-center gap-3 bg-blue-50 px-5 py-2.5 dark:bg-blue-950/30",
  tableBulkLabelPrimary: "text-sm font-semibold text-blue-900 dark:text-blue-200",
  tableBulkDividerPrimary: "h-4 w-px bg-blue-300 dark:bg-blue-700",
  tableBulkClearPrimary:
    "text-sm font-semibold text-blue-800 underline underline-offset-2 transition hover:text-blue-900 dark:text-blue-300 dark:hover:text-blue-200",
  tableBulkRestoreButton:
    "inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60",
  // Destructive action → red text on a red-outlined white surface, not a red
  // fill (design system §16).
  tableBulkDeleteButton:
    "inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3.5 py-2 text-sm font-semibold text-red-600 transition hover:border-red-300 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-red-900 dark:bg-slate-900 dark:text-red-400 dark:hover:bg-red-950/30",
  mobileBulkBarPrimary:
    "fixed inset-x-0 bottom-0 z-40 flex items-center gap-3 border-t border-blue-300 bg-blue-50 px-4 py-3 md:hidden dark:border-blue-700 dark:bg-blue-950/40",
  mobileBulkClearButtonPrimary:
    "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-blue-300 bg-white text-blue-800 transition hover:bg-blue-100 dark:border-blue-700 dark:bg-slate-900 dark:text-blue-300",
  // Archived-row Restore button — blue outline + refresh icon per figma.
  restoreButton:
    "inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-white px-3 py-1.5 text-[13px] font-semibold text-blue-600 transition hover:border-blue-300 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-blue-900/60 dark:bg-slate-900 dark:text-blue-300 dark:hover:bg-blue-950/40",
  tableEmptyState:
    "rounded-2xl border border-slate-200 bg-white px-4 py-10 text-center text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400",
  // First-run empty state with a guided call to action.
  tableEmptyCta:
    "flex flex-col items-center rounded-2xl border border-slate-200 bg-white px-6 py-12 text-center dark:border-slate-800 dark:bg-slate-900",
  tableEmptyCtaTitle: "m-0 text-base font-semibold text-slate-900 dark:text-slate-100",
  tableEmptyCtaText: "m-0 mt-1.5 max-w-sm text-sm text-slate-500 dark:text-slate-400",
  // ── First-run "Get started" checklist (Home) ──────────────────────────────
  getStartedCard:
    "dashboard-reveal rounded-2xl border border-blue-200 bg-blue-50/60 p-4 shadow-sm dark:border-blue-900/70 dark:bg-blue-950/30 sm:p-5",
  getStartedEyebrow:
    "m-0 text-xs font-semibold uppercase tracking-[0.14em] text-blue-800 dark:text-blue-300",
  getStartedTitle: "m-0 mt-1 text-sm font-semibold text-blue-900 dark:text-blue-100",
  getStartedList: "m-0 mt-3 flex list-none flex-col gap-2 p-0",
  getStartedRow:
    "flex items-center gap-3 rounded-xl border border-blue-100 bg-white px-3 py-2.5 dark:border-blue-900/50 dark:bg-slate-900/60",
  getStartedCheckDone:
    "flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white",
  getStartedCheckTodo:
    "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-slate-300 dark:border-slate-600",
  getStartedStepButton:
    "shrink-0 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-700",
  tableIconButton:
    "inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-400 transition hover:border-slate-300 hover:bg-slate-100 hover:text-slate-700 dark:border-slate-700 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-200",
  tableIconButtonDestructive:
    "inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-400 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:opacity-50 dark:border-slate-700 dark:text-slate-500 dark:hover:bg-red-950/30 dark:hover:text-red-400",

  // ── Dropdown menus ────────────────────────────────────────────────────────
  dropdownMenu:
    "absolute right-0 z-20 mt-1 min-w-28 rounded-lg border border-slate-200 bg-white p-1 shadow-lg dark:border-slate-700 dark:bg-slate-900",
  dropdownMenuItem:
    "inline-flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs font-medium text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800",
  dropdownMenuItemDestructive:
    "inline-flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs font-medium text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60 dark:text-red-300 dark:hover:bg-red-950/30",

  // ── Mobile client cards ────────────────────────────────────────────────────
  mobileClientCard:
    "rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900",
  mobileActionButton:
    "inline-flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800",

  // ── Modal variants ────────────────────────────────────────────────────────
  modalSurfaceLarge:
    "animate-slide-up motion-reduce:animate-none sm:animate-none max-h-[82vh] w-full overflow-y-auto rounded-t-3xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-800 dark:bg-slate-900 sm:max-h-[92vh] sm:max-w-2xl sm:rounded-3xl sm:p-6",
  modalCloseButton:
    "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-700 transition hover:border-slate-300 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800",

  // ── Legal pages ───────────────────────────────────────────────────────────
  legalPageContainer:
    "rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-5",
  legalPageTitle: "m-0 text-xl font-semibold text-slate-900 dark:text-slate-100",
  legalPageUpdatedAt: "mt-1 text-xs text-slate-500 dark:text-slate-400",
  legalPageContent: "mt-4 grid gap-4 text-sm text-slate-700 dark:text-slate-300",
  legalSectionTitle: "m-0 mb-1 font-semibold text-slate-800 dark:text-slate-200",
  legalLink:
    "text-blue-600 underline hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300",
  legalFooter: "mt-5 border-t border-slate-200 pt-4 dark:border-slate-700",
  legalBackLink:
    "inline-flex items-center py-1 text-sm text-blue-600 underline hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300",

  // ── Account settings modal ───────────────────────────────────────────────
  modalSheetHandleWrap: "sm:hidden -mx-4 -mt-4 mb-3 flex justify-center pb-1 pt-2.5",
  modalSheetHandle: "h-1.5 w-10 rounded-full bg-slate-300 dark:bg-slate-600",
  accountSettingsTitle: "m-0 text-lg font-semibold text-slate-900 dark:text-slate-100",
  accountSettingsDescription: "m-0 mt-1 text-sm text-slate-600 dark:text-slate-300",
  accountSettingsFieldLabel: "grid gap-1 text-sm text-slate-700 dark:text-slate-300",
  accountSettingsInput:
    "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition hover:border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 sm:px-4 sm:py-3",
  accountSettingsReadOnlyInput:
    "w-full rounded-xl border border-slate-200 bg-slate-100 px-3 py-2.5 text-sm text-slate-600 outline-none disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 sm:px-4 sm:py-3",
  accountSettingsPasswordInputBase:
    "w-full rounded-xl border bg-white px-3 py-2.5 pr-10 text-sm text-slate-900 outline-none transition hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-slate-800 dark:text-slate-100 sm:px-4 sm:py-3",
  passwordVisibilityButton:
    "absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300",
  breakReminderInfoBanner:
    "m-0 rounded-xl border border-blue-100 bg-blue-50/70 px-3 py-2 text-sm font-normal text-blue-900 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-200",
  accountSettingsScheduleCard:
    "rounded-xl border border-slate-200 bg-white px-3 py-1 dark:border-slate-700 dark:bg-slate-900",
  objectiveSelectorIcon:
    "inline-flex h-5 w-5 items-center justify-center pt-px text-slate-500 dark:text-slate-400",
  objectiveSelectorBadge: "m-0 mt-1 text-xs font-medium text-slate-600 dark:text-slate-400",
  accountSettingsFooterBar:
    "-mx-4 mt-4 flex justify-end gap-2 border-t border-slate-200 bg-white px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3 dark:border-slate-800 dark:bg-slate-900 sm:mx-0 sm:px-0 sm:pb-0",
  accountSettingsSecondaryButton:
    "rounded-xl bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700",
  accountSettingsPrimaryButton:
    "rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60",

  // ── Account settings modal tabs ──────────────────────────────────────────
  settingsTabButtonBase:
    "border-b-[3px] px-1 pb-3 pt-3 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50",
  settingsTabButtonActive: "border-blue-700 text-blue-700 dark:border-blue-400 dark:text-blue-300",
  settingsTabButtonInactive:
    "border-transparent text-slate-600 hover:border-slate-300 hover:text-slate-800 dark:text-slate-400 dark:hover:border-slate-600 dark:hover:text-slate-200",

  // ── Table sort controls ────────────────────────────────────────────────────
  tableSortButtonBase:
    "inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-normal transition hover:text-slate-700 dark:hover:text-slate-200",
  tableSortButtonFilterBase:
    "inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-normal transition hover:text-slate-700 dark:hover:text-slate-200",
  tableSortButtonBaseEnd:
    "inline-flex w-full items-center justify-end gap-1 text-xs font-semibold uppercase tracking-normal transition hover:text-slate-700 dark:hover:text-slate-200",
  tableSortButtonActive: "text-blue-600 dark:text-blue-400",
  tableSortButtonInactive: "text-slate-500 dark:text-slate-400",
};
