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
  appShell:
    "flex min-h-screen flex-col bg-gradient-to-b from-slate-50 to-white dark:bg-none dark:bg-slate-950",
  stickyHeaderShell: "sticky top-0 z-30 w-full",
  appHeader:
    "relative z-40 w-full bg-[linear-gradient(270deg,rgba(236,254,255,0.75)_0%,rgba(239,246,255,0.7)_40%,rgba(241,245,249,0.65)_75%,rgba(248,250,252,0.6)_100%)] backdrop-blur-md dark:bg-[linear-gradient(270deg,rgba(8,47,73,0.45)_0%,rgba(14,116,144,0.4)_40%,rgba(15,23,42,0.38)_75%,rgba(15,23,42,0.32)_100%)]",
  appHeaderBackgroundGradient:
    "bg-[linear-gradient(135deg,rgba(255,255,255,0.96)_0%,rgba(248,250,252,0.94)_58%,rgba(236,254,255,0.92)_100%)] dark:bg-[linear-gradient(135deg,rgba(2,6,23,0.96)_0%,rgba(15,23,42,0.94)_60%,rgba(8,47,73,0.9)_100%)]",
  appHeaderInner: "mx-auto flex w-full max-w-7xl items-center justify-between px-6",
  tabStrip: "relative z-30 w-full bg-slate-50/95 backdrop-blur-sm dark:bg-slate-950/95",
  appFooter:
    "w-full bg-[linear-gradient(90deg,rgba(236,254,255,0.75)_0%,rgba(239,246,255,0.7)_40%,rgba(241,245,249,0.65)_75%,rgba(248,250,252,0.6)_100%)] dark:bg-[linear-gradient(90deg,rgba(8,47,73,0.45)_0%,rgba(14,116,144,0.4)_40%,rgba(15,23,42,0.38)_75%,rgba(15,23,42,0.32)_100%)]",
  appFooterInner:
    "mx-auto flex w-full max-w-7xl flex-col items-start gap-3 px-4 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-6 sm:pb-4",
  contentWrapper: "mx-auto w-full max-w-7xl flex-1 px-4 pb-6 sm:px-6",
  tabNav: "flex gap-6 border-b border-slate-200/50 dark:border-slate-800/50",
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
    "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition hover:border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 sm:px-4 sm:py-1.5",
  recurrenceInput:
    "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition hover:border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100",
  dateInput:
    "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition hover:border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100",
  dateInputTrigger:
    "flex items-center gap-2 rounded-xl border border-blue-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-1 ring-blue-100 transition hover:border-blue-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-blue-800 dark:bg-slate-900 dark:text-slate-100 dark:ring-blue-900/40 cursor-pointer",
  dateInputTriggerCompact:
    "flex w-36 shrink-0 items-center gap-2 rounded-xl border border-blue-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-1 ring-blue-100 transition hover:border-blue-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-blue-800 dark:bg-slate-900 dark:text-slate-100 dark:ring-blue-900/40 cursor-pointer",
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
  mobileStepNav: "grid grid-cols-3 gap-1.5 sm:gap-2",
  mobileStepButton:
    "rounded-xl border px-2 py-2.5 text-[0.72rem] font-semibold leading-tight transition sm:px-2.5 sm:py-2 sm:text-xs",
  mobileStepButtonActive:
    "border-blue-600 bg-blue-50 text-blue-700 dark:border-blue-500 dark:bg-blue-950/40 dark:text-blue-200",
  mobileStepButtonInactive:
    "border-slate-300 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800",
  mobileReviewCard:
    "grid gap-2 rounded-2xl border border-slate-200 bg-slate-50/90 p-3 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-200",
  stickyFooter:
    "sticky bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-30 rounded-2xl border border-slate-200 bg-white/95 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] shadow-lg backdrop-blur dark:border-slate-700 dark:bg-slate-900/95 sm:bottom-3 sm:pb-3",

  // ── Patient selection two-column layout ────────────────────────────────────
  patientSelectionGrid: "grid grid-cols-1 gap-4 md:grid-cols-2 md:items-start",
  patientColumnLabel:
    "m-0 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400",
  patientSearchContainer:
    "flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-900 sm:px-4 sm:py-3 md:h-[26rem]",
  secondaryIconButton:
    "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700",

  // ── Selectable list (patient search results) ───────────────────────────────
  selectableList: "m-0 min-h-0 flex-1 list-none space-y-2 overflow-y-auto p-0 pr-2",
  selectableItemButton:
    "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-left text-sm transition hover:bg-slate-50 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-950 dark:hover:bg-slate-900",

  // ── Action rows ────────────────────────────────────────────────────────────
  actionRow: "flex justify-end",
  actionButtons: "flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center",

  // ── Destination list ───────────────────────────────────────────────────────
  destinationList:
    "overflow-y-auto rounded-2xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-900 sm:px-4 sm:py-3 md:h-[26rem]",
  destinationItem:
    "flex flex-col gap-2.5 text-sm text-slate-900 dark:text-slate-200 md:flex-row md:items-start md:justify-between md:gap-3",
  destinationItemBody: "flex min-w-0 flex-1 items-start gap-2.5 sm:gap-3",
  destinationDetailsToggle:
    "w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 sm:w-auto",
  destinationRemove:
    "w-full rounded-lg border border-red-200 px-2 py-1.5 text-xs font-medium text-red-700 transition hover:bg-red-50 dark:border-red-900/60 dark:text-red-300 dark:hover:bg-red-950/30 sm:w-auto sm:self-start sm:py-1",
  destinationRemoveIcon:
    "inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition hover:bg-red-50 hover:text-red-600 dark:text-slate-500 dark:hover:bg-red-950/30 dark:hover:text-red-400",
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
    "rounded-full bg-slate-200 px-3 py-0.5 text-xs font-bold text-slate-700 dark:bg-slate-700 dark:text-slate-200 sm:text-sm",

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
  mobileContinueButton:
    "inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 disabled:hover:bg-slate-300 dark:disabled:bg-blue-950/70 dark:disabled:text-slate-400 dark:disabled:hover:bg-blue-950/70",
  mobileContinueHint: "m-0 mb-2 text-center text-xs text-slate-500 dark:text-slate-400",
  stepCheckIcon: "shrink-0 text-green-600 dark:text-green-400",
  stepNumberBadge: "text-[0.6rem] font-bold opacity-50",

  // ── Optimization objective selector ─────────────────────────────────────────
  objectiveSelectorGroup: "flex gap-3 sm:gap-4",
  objectiveSelectorOption:
    "flex flex-1 cursor-pointer items-start gap-2.5 rounded-xl border border-slate-200 px-3 py-2.5 transition hover:border-slate-300 has-[:checked]:border-blue-400 has-[:checked]:bg-blue-50/80 dark:border-slate-700 dark:hover:border-slate-600 dark:has-[:checked]:border-blue-600 dark:has-[:checked]:bg-blue-900/25",
  objectiveSelectorLabel: "text-xs font-semibold text-slate-800 dark:text-slate-100",
  objectiveSelectorDescription: "mt-0.5 text-xs text-slate-500 dark:text-slate-400",
  segmentedControlContainer: "inline-flex rounded-lg bg-slate-100 p-1 dark:bg-slate-800",
  segmentedControlButtonBase: "rounded-md px-2.5 py-1 text-xs transition",
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
    "grid gap-4 rounded-2xl border border-slate-200 bg-gradient-to-br from-white via-slate-50 to-blue-50/70 p-3 dark:border-slate-800 dark:from-slate-900 dark:via-slate-900 dark:to-blue-950/20 sm:rounded-[28px] sm:p-4",
  routeSkeletonHeader: "grid gap-3",
  routeSkeletonTimelineMap:
    "mt-5 flex flex-col gap-4 xl:grid xl:grid-cols-[minmax(0,0.9fr)_minmax(22rem,1.1fr)]",
  routeSkeletonCard:
    "rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:rounded-[28px] sm:p-4",
  routeSkeletonStatsGrid: "grid grid-cols-2 gap-2 xl:grid-cols-4",
  routeSkeletonSplitHeader: "flex items-start justify-between gap-3",
  routeSkeletonCardHeader: "grid gap-2",
  routeSkeletonTimelineList: "mt-4 grid gap-3",
  routeSkeletonMapStack: "mt-4 grid gap-3",
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
    "block rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-300 hover:shadow dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700 sm:p-5",
  dashboardKpiLabel:
    "m-0 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400",
  dashboardKpiValue: "m-0 mt-2 text-2xl font-semibold text-slate-900 dark:text-slate-100",
  dashboardKpiDelta: "m-0 mt-2 text-xs font-semibold",
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
  dashboardTrendFill: "h-full rounded-full bg-gradient-to-r from-cyan-500 to-blue-600",
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
  requiredBadge:
    "rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700 dark:bg-red-950/40 dark:text-red-300",

  // ── Tables ────────────────────────────────────────────────────────────────
  tableCard:
    "overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900",
  tableRow: "group transition hover:bg-slate-50 dark:hover:bg-slate-800/40",
  tableEmptyState:
    "rounded-2xl border border-slate-200 bg-white px-4 py-10 text-center text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400",
  tableIconButton:
    "inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-200",
  tableIconButtonDestructive:
    "inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50 dark:text-slate-500 dark:hover:bg-red-950/30 dark:hover:text-red-400",

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
