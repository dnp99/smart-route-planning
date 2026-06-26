import { describe, expect, it } from "vitest";
import type { Patient } from "../../../../shared/contracts";
import { computeClientStats } from "../../features/patients/domain/clientStats";

const makePatient = (overrides: Partial<Patient>): Patient => ({
  id: "patient",
  nurseId: "nurse-1",
  firstName: "A",
  lastName: "B",
  address: "123 Main St",
  googlePlaceId: null,
  visitDurationMinutes: 30,
  preferredVisitStartTime: "09:00:00",
  preferredVisitEndTime: "10:00:00",
  visitTimeType: "fixed",
  visitWindows: [],
  createdAt: "2026-03-12T12:00:00.000Z",
  updatedAt: "2026-03-12T12:00:00.000Z",
  ...overrides,
});

const fixedWindow = {
  id: "w-f",
  startTime: "09:00:00",
  endTime: "10:00:00",
  visitTimeType: "fixed" as const,
};
const flexWindow = {
  id: "w-x",
  startTime: "11:00:00",
  endTime: "16:00:00",
  visitTimeType: "flexible" as const,
};

describe("computeClientStats", () => {
  it("counts fixed/flexible via the shared classifier and rounds avg duration", () => {
    const patients = [
      makePatient({ id: "1", visitDurationMinutes: 30, visitWindows: [fixedWindow] }),
      makePatient({ id: "2", visitDurationMinutes: 20, visitWindows: [fixedWindow] }),
      makePatient({ id: "3", visitDurationMinutes: 40, visitWindows: [flexWindow] }),
      // multi-type windows → "mixed": counts toward neither fixed nor flexible
      makePatient({ id: "4", visitDurationMinutes: 10, visitWindows: [fixedWindow, flexWindow] }),
    ];

    const stats = computeClientStats(patients);

    expect(stats.total).toBe(4);
    expect(stats.fixed).toBe(2);
    expect(stats.flexible).toBe(1);
    // fixed + flexible < total because of the mixed client
    expect(stats.fixed + stats.flexible).toBeLessThan(stats.total);
    // round((30 + 20 + 40 + 10) / 4) = 25
    expect(stats.avgDuration).toBe(25);
  });

  it("falls back to legacy visitTimeType when there are no windows", () => {
    const patients = [
      makePatient({ id: "1", visitTimeType: "flexible", visitWindows: [] }),
      makePatient({ id: "2", visitTimeType: "fixed", visitWindows: [] }),
    ];

    const stats = computeClientStats(patients);

    expect(stats).toMatchObject({ total: 2, fixed: 1, flexible: 1 });
  });

  it("returns zeros for an empty list", () => {
    expect(computeClientStats([])).toEqual({ total: 0, fixed: 0, flexible: 0, avgDuration: 0 });
  });
});
