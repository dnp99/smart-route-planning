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
  appHeader: "sticky top-0 z-30 w-full bg-slate-50/95 backdrop-blur-sm dark:bg-slate-950/95",
  appHeaderInner:
    "mx-auto flex w-full max-w-7xl items-center gap-3 px-4 sm:px-6 transition-[padding] duration-300",
  appFooter: "w-full bg-transparent dark:bg-transparent",
  appFooterInner:
    "mx-auto flex w-full max-w-7xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-4",
  contentWrapper: "mx-auto w-full max-w-7xl flex-1 px-4 pb-6 sm:px-6",
  tabNav: "flex gap-6 border-b border-slate-200 dark:border-slate-800",
  // ── Header quote ──────────────────────────────────────────────────────────
  headerQuote:
    "m-0 hidden min-w-0 max-w-[50vw] text-right text-xs italic text-slate-600 line-clamp-2 sm:block sm:text-sm dark:text-slate-300",
  // ── Account menu ──────────────────────────────────────────────────────────
  accountMenuButton:
    "inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-700 transition hover:border-slate-300 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 dark:border-slate-700 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-800",
  accountMenuDropdown:
    "absolute right-0 z-20 mt-2 min-w-44 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg dark:border-slate-700 dark:bg-slate-900",
  // ── Modal ─────────────────────────────────────────────────────────────────
  modalBackdrop:
    "fixed inset-0 z-50 flex items-end justify-center bg-slate-950/45 p-0 sm:items-center sm:p-3",
  modalSurface:
    "animate-slide-up motion-reduce:animate-none sm:animate-none max-h-[82vh] w-full overflow-y-auto rounded-t-3xl border border-slate-200 bg-white p-4 shadow-2xl dark:border-slate-700 dark:bg-slate-900 sm:max-h-[92vh] sm:max-w-xl sm:rounded-2xl sm:p-5",
  confirmDialogSurface:
    "animate-slide-up motion-reduce:animate-none sm:animate-none w-full rounded-t-3xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-700 dark:bg-slate-900 sm:max-w-sm sm:rounded-2xl",
  confirmDialogTitle: "m-0 mb-1 text-base font-semibold text-slate-900 dark:text-slate-100",
  confirmDialogMessage: "m-0 mb-5 text-sm text-slate-600 dark:text-slate-300",
  destructiveButton:
    "rounded-xl bg-red-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60",
  // ── Scroll-to-top button ──────────────────────────────────────────────────
  scrollToTopButton:
    "fixed bottom-[calc(1.5rem+env(safe-area-inset-bottom))] right-4 z-40 flex h-10 w-10 items-center justify-center rounded-full border border-slate-300 bg-white/90 shadow-md backdrop-blur transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900/90 dark:hover:bg-slate-800 lg:bottom-6 lg:left-[calc(50%+36rem+0.75rem)] lg:right-auto",

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

  // ── Input ─────────────────────────────────────────────────────────────────
  // bg-white · border-slate-200 · hover:border-slate-300 · focus:ring-blue-100
  searchInput:
    "w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition hover:border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 sm:px-4 sm:py-3",

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
    "sticky bottom-2 z-30 rounded-2xl border border-slate-200 bg-white/95 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] shadow-lg backdrop-blur dark:border-slate-700 dark:bg-slate-900/95 sm:bottom-3 sm:pb-3",

  // ── Patient selection two-column layout ────────────────────────────────────
  patientSelectionGrid: "grid grid-cols-1 gap-4 md:grid-cols-2 md:items-start",
  patientColumnLabel:
    "m-0 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400",
  patientSearchContainer:
    "grid gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-900 sm:px-4 sm:py-3",

  // ── Selectable list (patient search results) ───────────────────────────────
  selectableList: "m-0 max-h-72 list-none space-y-2 overflow-y-auto p-0",
  selectableItemButton:
    "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-left text-sm transition hover:bg-slate-50 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-950 dark:hover:bg-slate-900",

  // ── Action rows ────────────────────────────────────────────────────────────
  actionRow: "flex justify-end",
  actionButtons: "flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center",

  // ── Destination list ───────────────────────────────────────────────────────
  destinationList:
    "max-h-72 overflow-y-auto rounded-2xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-900 sm:px-4 sm:py-3",
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
    "inline-flex w-fit rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
  visitTypePillFixed: "bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-200",
  visitTypePillFlexible:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-200",
  countPill:
    "rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 dark:border-blue-900/70 dark:bg-blue-950/20 dark:text-blue-300 sm:text-sm",

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
    "rounded-xl border border-slate-200 bg-white px-3 py-3 shadow-sm transition hover:shadow dark:border-slate-700/80 dark:bg-slate-950/60 sm:px-3 sm:py-3",
  resultStatLabel: "text-xs font-medium text-slate-500 dark:text-slate-400",
  resultStatValue:
    "mt-0.5 text-[0.95rem] font-semibold tracking-tight text-slate-900 dark:text-slate-100 sm:text-lg",
  resultStatMeta: "mt-0.5 text-xs text-slate-500 dark:text-slate-400 sm:text-sm",
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

  // ── Mobile planner ───────────────────────────────────────────────────────────
  mobileContinueButton:
    "inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 disabled:hover:bg-slate-300 dark:disabled:bg-blue-950/70 dark:disabled:text-slate-400 dark:disabled:hover:bg-blue-950/70",
  mobileContinueHint: "m-0 mb-2 text-center text-xs text-slate-500 dark:text-slate-400",
  stepCheckIcon: "shrink-0 text-green-600 dark:text-green-400",
  stepNumberBadge: "text-[0.6rem] font-bold opacity-50",

  // ── Submit / optimize ────────────────────────────────────────────────────────
  spinnerWhite: "h-4 w-4 animate-spin rounded-full border-2 border-white/70 border-t-white",
  visitCountPill:
    "inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  optimizeButtonLarge:
    "optimize-route-button inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 disabled:hover:bg-slate-300 dark:disabled:bg-blue-950/70 dark:disabled:text-slate-400 dark:disabled:hover:bg-blue-950/70 sm:w-auto",

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
  scheduleEditorFields: "flex flex-wrap items-center gap-1.5 sm:gap-2",
  scheduleEditorTimeInput:
    "w-28 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-sm font-medium tabular-nums text-slate-900 outline-none transition hover:border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 sm:w-32",
  scheduleEditorLunchRow:
    "mt-1.5 flex flex-wrap items-center gap-2 pl-0 text-sm text-slate-600 dark:text-slate-400",
  scheduleEditorLunchInput:
    "w-20 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-sm font-medium tabular-nums text-slate-900 outline-none transition hover:border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100",
  scheduleEditorToggle:
    "h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 dark:border-slate-600",
  scheduleThresholdRow:
    "mt-3 flex flex-wrap items-center gap-2.5 border-t border-slate-100 pt-3 text-sm text-slate-600 dark:border-slate-800 dark:text-slate-400",
  scheduleThresholdInput:
    "w-20 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-sm font-medium tabular-nums text-slate-900 outline-none transition hover:border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100",
};
