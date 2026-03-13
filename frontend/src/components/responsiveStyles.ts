export const responsiveStyles = {
  page: "mt-2 w-full sm:mt-4 md:mt-6",
  section:
    "rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-5 md:p-6",
  surfaceCard:
    "rounded-3xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-5",
  sectionHeader: "mb-3 grid gap-2 sm:mb-4 sm:gap-3",
  cardHeader: "mb-2 grid gap-1 sm:mb-3",
  cardTitle: "m-0 text-base font-semibold text-slate-900 dark:text-slate-100 sm:text-lg",
  cardDescription: "m-0 text-sm text-slate-500 dark:text-slate-400",
  form: "grid gap-2.5 sm:gap-3",
  searchInput:
    "w-full rounded-2xl border border-slate-300 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 sm:px-4 sm:py-3",
  panel:
    "grid gap-3 rounded-2xl border border-slate-200 bg-slate-50/85 p-3 dark:border-slate-800 dark:bg-slate-950/35 sm:p-4",
  panelMuted:
    "rounded-2xl border border-slate-200 bg-white px-3 py-5 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400 sm:px-4 sm:py-6",
  selectableList:
    "m-0 max-h-56 list-none space-y-2 overflow-y-auto p-0",
  selectableItemButton:
    "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-left text-sm transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:hover:bg-slate-900",
  actionRow: "flex justify-end",
  actionButtons:
    "flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center",
  secondaryButton:
    "w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 sm:w-auto sm:py-1.5",
  primaryButton:
    "w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 sm:w-auto sm:py-1.5",
  destinationList:
    "rounded-2xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-900 sm:px-4 sm:py-3",
  destinationItem:
    "flex flex-col gap-2.5 text-sm text-slate-900 dark:text-slate-200 md:flex-row md:items-start md:justify-between md:gap-3",
  destinationItemBody: "flex min-w-0 flex-1 items-start gap-2.5 sm:gap-3",
  destinationRemove:
    "w-full rounded-lg border border-red-200 px-2 py-1.5 text-xs font-medium text-red-700 transition hover:bg-red-50 dark:border-red-900/60 dark:text-red-300 dark:hover:bg-red-950/30 sm:w-auto sm:self-start sm:py-1",
  footerRow:
    "mt-1 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between",
  countPill:
    "rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-200 sm:text-sm",
  optimizeButton:
    "inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 disabled:hover:bg-slate-300 dark:disabled:bg-blue-950/70 dark:disabled:text-slate-400 dark:disabled:hover:bg-blue-950/70 sm:w-auto",
  resultHeader: "flex flex-col gap-2",
  resultCtaStack: "mt-3 grid w-full gap-2",
  googleMapsButton:
    "inline-flex w-full items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-100 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-200 dark:hover:bg-emerald-950/50",
  resultInfoNote:
    "inline-flex w-full items-start gap-2 rounded-xl border border-slate-200/90 bg-slate-100/80 px-3 py-2 text-left text-xs text-slate-600 dark:border-slate-700/80 dark:bg-slate-900/50 dark:text-slate-400",
  resultStatsGrid:
    "mt-4 grid w-full gap-3 sm:grid-cols-2",
  resultStatCard:
    "rounded-xl border border-slate-200/90 bg-white/85 px-3 py-2 dark:border-slate-700/80 dark:bg-slate-950/60",
  resultStatLabel:
    "text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400",
  resultStatValue:
    "mt-0.5 text-base font-bold tracking-tight text-slate-950 dark:text-white sm:text-lg",
  resultStatMeta: "mt-0.5 text-sm text-slate-600 dark:text-slate-300",
  resultEndpoints:
    "mt-4 grid gap-3 rounded-2xl bg-slate-100/80 p-3 dark:bg-slate-900/55 sm:grid-cols-2",
  resultEndpointCard:
    "rounded-xl border border-slate-200/90 bg-white/85 px-3 py-3 dark:border-slate-700/80 dark:bg-slate-950/60",
  resultEndpointLabel:
    "text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400",
  resultEndpointValue:
    "mt-1 text-sm font-medium leading-6 text-slate-800 dark:text-slate-100",
  map: "h-48 w-full overflow-hidden rounded-xl border border-slate-300 dark:border-slate-700 sm:h-64 md:h-72",
};
