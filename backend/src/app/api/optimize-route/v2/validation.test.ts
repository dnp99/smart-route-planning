import { describe, expect, it } from "vitest";
import { HttpError } from "../../../../lib/http";
import { parseAndValidateBody } from "./validation";

const expectHttpError = (fn: () => unknown, status: number, message: string) => {
  try {
    fn();
    throw new Error("Expected function to throw HttpError");
  } catch (error) {
    expect(error).toBeInstanceOf(HttpError);
    expect((error as HttpError).status).toBe(status);
    expect((error as HttpError).message).toBe(message);
  }
};

const minutesToTime = (minutes: number) => {
  const hours = Math.floor(minutes / 60)
    .toString()
    .padStart(2, "0");
  const minutePart = (minutes % 60).toString().padStart(2, "0");
  return `${hours}:${minutePart}`;
};

const buildValidPayload = () => ({
  planningDate: "2026-03-13",
  timezone: "America/Toronto",
  start: {
    address: "3361 Ingram Road, Mississauga, ON",
    departureTime: "2026-03-13T07:30:00-04:00",
  },
  end: {
    address: "3361 Ingram Road, Mississauga, ON",
  },
  visits: [
    {
      visitId: "visit-1",
      patientId: "patient-1",
      patientName: "Jane Doe",
      address: "123 Main St",
      windowStart: "08:30",
      windowEnd: "09:00",
      windowType: "fixed" as const,
      serviceDurationMinutes: 20,
    },
    {
      visitId: "visit-2",
      patientId: "patient-2",
      patientName: "John Doe",
      address: "456 Queen St",
      windowStart: "10:00",
      windowEnd: "11:00",
      windowType: "flexible" as const,
      serviceDurationMinutes: 30,
    },
  ],
});

describe("optimize-route v2 request validation", () => {
  it("returns normalized request payload", () => {
    const payload = parseAndValidateBody({
      planningDate: " 2026-03-13 ",
      timezone: " America/Toronto ",
      start: {
        address: " 3361 Ingram Road, Mississauga, ON ",
        googlePlaceId: "  start-place ",
        departureTime: " 2026-03-13T07:30:00-04:00 ",
      },
      end: {
        address: " 3361 Ingram Road, Mississauga, ON ",
        googlePlaceId: "  ",
      },
      visits: [
        {
          visitId: " visit-1 ",
          patientId: " patient-1 ",
          patientName: " Jane Doe ",
          address: " 123 Main St ",
          googlePlaceId: "  place-1 ",
          windowStart: " 08:30 ",
          windowEnd: " 09:00 ",
          windowType: "fixed",
          serviceDurationMinutes: 20,
          priority: 1,
        },
      ],
    });

    expect(payload).toEqual({
      planningDate: "2026-03-13",
      timezone: "America/Toronto",
      start: {
        address: "3361 Ingram Road, Mississauga, ON",
        googlePlaceId: "start-place",
        departureTime: "2026-03-13T07:30:00-04:00",
      },
      end: {
        address: "3361 Ingram Road, Mississauga, ON",
        googlePlaceId: null,
      },
      visits: [
        {
          visitId: "visit-1",
          patientId: "patient-1",
          patientName: "Jane Doe",
          address: "123 Main St",
          googlePlaceId: "place-1",
          windowStart: "08:30",
          windowEnd: "09:00",
          windowType: "fixed",
          serviceDurationMinutes: 20,
          priority: 1,
        },
      ],
    });
  });

  it("accepts missing departure time and leaves it undefined", () => {
    const payload = buildValidPayload();
    delete (payload.start as { departureTime?: string }).departureTime;

    const parsed = parseAndValidateBody(payload);

    expect(parsed.start).toEqual({
      address: "3361 Ingram Road, Mississauga, ON",
    });
  });

  it("keeps same-address visits when visit ids differ", () => {
    const payload = parseAndValidateBody({
      ...buildValidPayload(),
      visits: [
        {
          visitId: "visit-am",
          patientId: "patient-1",
          patientName: "Yasmin Ramji",
          address: "6931 Forest Park Drive, Mississauga, ON",
          windowStart: "08:30",
          windowEnd: "09:00",
          windowType: "fixed",
          serviceDurationMinutes: 20,
        },
        {
          visitId: "visit-pm",
          patientId: "patient-1",
          patientName: "Yasmin Ramji",
          address: "6931 Forest Park Drive, Mississauga, ON",
          windowStart: "19:30",
          windowEnd: "20:00",
          windowType: "fixed",
          serviceDurationMinutes: 20,
        },
      ],
    });

    expect(payload.visits).toHaveLength(2);
  });

  it("throws for invalid body shape", () => {
    expectHttpError(() => parseAndValidateBody(null), 400, "Invalid request body.");
  });

  it("throws when visits is missing", () => {
    expectHttpError(
      () =>
        parseAndValidateBody({
          planningDate: "2026-03-13",
          timezone: "America/Toronto",
          start: {
            address: "Start",
            departureTime: "2026-03-13T07:30:00-04:00",
          },
          end: {
            address: "End",
          },
        }),
      400,
      "visits must be an array.",
    );
  });

  it("throws when start is not a JSON object", () => {
    const payload = buildValidPayload();

    expectHttpError(
      () =>
        parseAndValidateBody({
          ...payload,
          start: null,
        }),
      400,
      "start must be a JSON object.",
    );
  });

  it("throws when end is not a JSON object", () => {
    const payload = buildValidPayload();

    expectHttpError(
      () =>
        parseAndValidateBody({
          ...payload,
          end: null,
        }),
      400,
      "end must be a JSON object.",
    );
  });

  it("throws when there are more than 40 visits", () => {
    const payload = buildValidPayload();
    payload.visits = Array.from({ length: 41 }).map((_, index) => ({
      visitId: `visit-${index}`,
      patientId: `patient-${index}`,
      patientName: `Patient ${index}`,
      address: `Address ${index}`,
      windowStart: "08:00",
      windowEnd: "09:00",
      windowType: "fixed" as const,
      serviceDurationMinutes: 15,
    }));

    expectHttpError(
      () => parseAndValidateBody(payload),
      400,
      "Please provide at most 40 visits.",
    );
  });

  it("throws when visit ids are duplicated", () => {
    const payload = buildValidPayload();
    payload.visits[1].visitId = payload.visits[0].visitId;

    expectHttpError(() => parseAndValidateBody(payload), 400, "visitId values must be unique.");
  });

  it("allows overlapping visit windows", () => {
    const payload = buildValidPayload();
    payload.visits = [
      {
        ...payload.visits[0],
        visitId: "visit-a",
        windowStart: "09:00",
        windowEnd: "10:00",
      },
      {
        ...payload.visits[1],
        visitId: "visit-b",
        windowStart: "09:00",
        windowEnd: "09:30",
      },
    ];

    const parsed = parseAndValidateBody(payload);
    expect(parsed.visits).toHaveLength(2);
    expect(parsed.visits[0].visitId).toBe("visit-a");
    expect(parsed.visits[1].visitId).toBe("visit-b");
  });

  it("allows flexible visits with no preferred window times", () => {
    const payload = buildValidPayload();
    payload.visits[1].windowStart = "";
    payload.visits[1].windowEnd = "";

    const parsed = parseAndValidateBody(payload);
    expect(parsed.visits[1]).toMatchObject({
      visitId: "visit-2",
      windowType: "flexible",
      windowStart: "",
      windowEnd: "",
    });
  });

  it("throws when flexible visit provides only one window boundary", () => {
    const payload = buildValidPayload();
    payload.visits[1].windowStart = "10:00";
    payload.visits[1].windowEnd = "";

    expectHttpError(
      () => parseAndValidateBody(payload),
      400,
      "John Doe flexible visit window must include both start and end time when one value is provided.",
    );
  });

  it("throws when fixed visit omits preferred window boundaries", () => {
    const payload = buildValidPayload();
    payload.visits[0].windowStart = "";
    payload.visits[0].windowEnd = "";

    expectHttpError(
      () => parseAndValidateBody(payload),
      400,
      "visits[0].windowStart is required.",
    );
  });

  it("throws for invalid visit window format", () => {
    const payload = buildValidPayload();
    payload.visits[0].windowStart = "8:30";

    expectHttpError(
      () => parseAndValidateBody(payload),
      400,
      "visits[0].windowStart must use HH:MM 24-hour format.",
    );
  });

  it("throws for cross-midnight or reversed windows", () => {
    const payload = buildValidPayload();
    payload.visits[0].windowStart = "23:30";
    payload.visits[0].windowEnd = "00:30";

    expectHttpError(
      () => parseAndValidateBody(payload),
      400,
      "visits[0].windowEnd must be later than visits[0].windowStart (cross-midnight windows are not supported).",
    );
  });

  it("throws when serviceDurationMinutes is invalid", () => {
    const payload = buildValidPayload();
    payload.visits[0].serviceDurationMinutes = 0;

    expectHttpError(
      () => parseAndValidateBody(payload),
      400,
      "visits[0].serviceDurationMinutes must be a positive integer.",
    );
  });

  it("throws when fixed window is shorter than service duration", () => {
    const payload = buildValidPayload();
    payload.visits[0].serviceDurationMinutes = 45;

    expectHttpError(
      () => parseAndValidateBody(payload),
      400,
      "Jane Doe fixed window must be at least 45 minutes long as per patient's profile.",
    );
  });

  it("throws when timezone is invalid", () => {
    const payload = buildValidPayload();
    payload.timezone = "Mars/Olympus";

    expectHttpError(
      () => parseAndValidateBody(payload),
      400,
      "timezone must be a valid IANA timezone.",
    );
  });

  it("throws when departure time does not include timezone", () => {
    const payload = buildValidPayload();
    payload.start.departureTime = "2026-03-13T07:30:00";

    expectHttpError(
      () => parseAndValidateBody(payload),
      400,
      "start.departureTime must be an ISO-8601 timestamp with timezone.",
    );
  });

  it("throws when departure date does not match planningDate in timezone", () => {
    const payload = buildValidPayload();
    payload.start.departureTime = "2026-03-14T01:00:00-04:00";

    expectHttpError(
      () => parseAndValidateBody(payload),
      400,
      "start.departureTime must match planningDate in timezone.",
    );
  });

  it("throws when unique locations exceed 25", () => {
    const payload = buildValidPayload();
    payload.visits = Array.from({ length: 24 }).map((_, index) => {
      const startMinutes = index * 30;
      return {
        visitId: `visit-${index}`,
        patientId: `patient-${index}`,
        patientName: `Patient ${index}`,
        address: `Unique Address ${index}`,
        windowStart: minutesToTime(startMinutes),
        windowEnd: minutesToTime(startMinutes + 30),
        windowType: "fixed" as const,
        serviceDurationMinutes: 15,
      };
    });
    payload.start.address = "Unique Start";
    payload.end.address = "Unique End";

    expectHttpError(
      () => parseAndValidateBody(payload),
      400,
      "Please provide at most 25 unique locations.",
    );
  });

  it("does not over-count unique locations when place id is shared", () => {
    const payload = buildValidPayload();
    payload.start.googlePlaceId = "same-place";
    payload.end.googlePlaceId = "same-place";
    payload.visits = [
      {
        visitId: "visit-1",
        patientId: "patient-1",
        patientName: "Patient 1",
        address: "Address A",
        googlePlaceId: "same-place",
        windowStart: "08:00",
        windowEnd: "09:00",
        windowType: "fixed",
        serviceDurationMinutes: 15,
      },
    ];

    const parsed = parseAndValidateBody(payload);
    expect(parsed.visits).toHaveLength(1);
  });
});
