// First-run "Get started" checklist — drives a new user from an empty account
// to their first optimized route. Pure + unit-tested; HomePage renders it.

export type GetStartedStep = {
  id: "working-hours" | "add-client" | "plan-route";
  label: string;
  detail: string;
  done: boolean;
  cta: string;
  to?: string; // in-app route link
  action?: "settings"; // opens the Account Settings modal
};

export type GetStartedInput = {
  workingHoursDone: boolean;
  hasClients: boolean;
  hasRunRoute: boolean;
};

export const buildGetStartedSteps = (input: GetStartedInput): GetStartedStep[] => [
  {
    id: "working-hours",
    label: "Set your working hours",
    detail: "So routes respect your shift.",
    done: input.workingHoursDone,
    cta: "Set hours",
    action: "settings",
  },
  {
    id: "add-client",
    label: "Add your first client",
    detail: "The people you visit — with their address and visit window.",
    done: input.hasClients,
    cta: "Add client",
    to: "/clients",
  },
  {
    id: "plan-route",
    label: "Plan your first route",
    detail: "Pick clients and let Routefy build the optimized order.",
    done: input.hasRunRoute,
    cta: "Plan route",
    to: "/route-planner",
  },
];

export const isGetStartedComplete = (steps: GetStartedStep[]): boolean =>
  steps.every((step) => step.done);

export const countGetStartedDone = (steps: GetStartedStep[]): number =>
  steps.filter((step) => step.done).length;
