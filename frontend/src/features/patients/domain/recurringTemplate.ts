import type { RecurringVisitTemplate } from "../../../../../shared/contracts";

/** Number of active recurring templates for a client (drives the Repeat badge). */
export const countActiveRecurringTemplates = (
  templates: RecurringVisitTemplate[] | undefined,
): number => (templates ? templates.filter((template) => template.isActive).length : 0);
