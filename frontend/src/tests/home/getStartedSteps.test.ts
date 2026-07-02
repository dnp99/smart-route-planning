import { describe, expect, it } from "vitest";
import {
  buildGetStartedSteps,
  countGetStartedDone,
  isGetStartedComplete,
} from "../../components/home/getStartedSteps";

describe("getStartedSteps", () => {
  it("builds the three onboarding steps in order with the given completion", () => {
    const steps = buildGetStartedSteps({
      workingHoursDone: true,
      hasClients: false,
      hasRunRoute: false,
    });
    expect(steps.map((s) => s.id)).toEqual(["working-hours", "add-client", "plan-route"]);
    expect(steps.map((s) => s.done)).toEqual([true, false, false]);
    expect(steps[1].to).toBe("/clients");
    expect(steps[2].to).toBe("/route-planner");
    expect(steps[0].action).toBe("settings");
  });

  it("reports completion count and all-complete", () => {
    const partial = buildGetStartedSteps({
      workingHoursDone: true,
      hasClients: true,
      hasRunRoute: false,
    });
    expect(countGetStartedDone(partial)).toBe(2);
    expect(isGetStartedComplete(partial)).toBe(false);

    const done = buildGetStartedSteps({
      workingHoursDone: true,
      hasClients: true,
      hasRunRoute: true,
    });
    expect(countGetStartedDone(done)).toBe(3);
    expect(isGetStartedComplete(done)).toBe(true);
  });
});
