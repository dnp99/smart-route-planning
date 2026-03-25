import { NextResponse } from "next/server";
import {
  isUpdateMeRequest,
  type AuthUser,
  type WeeklyWorkingHours,
} from "../../../../../../shared/contracts";
import { requireAuth } from "../../../../lib/auth/requireAuth";
import { buildCorsHeaders, HttpError, toErrorResponse } from "../../../../lib/http";
import {
  findNurseById,
  updateNurseHomeAddress,
  updateNurseOptimizationObjective,
  updateNurseWorkingHours,
} from "../../../../lib/patients/patientRepository";
import { requireSecureAuthTransport } from "../requestGuards";

const MAX_HOME_ADDRESS_LENGTH = 200;
const HH_MM_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

const toAuthUser = (value: {
  id: string;
  email: string;
  displayName: string;
  homeAddress?: string | null;
  workingHours?: WeeklyWorkingHours | null;
  breakGapThresholdMinutes?: number | null;
  optimizationObjective?: string | null;
}): AuthUser => ({
  id: value.id,
  email: value.email,
  displayName: value.displayName,
  homeAddress: value.homeAddress ?? null,
  workingHours: value.workingHours ?? null,
  breakGapThresholdMinutes: value.breakGapThresholdMinutes ?? null,
  optimizationObjective:
    value.optimizationObjective === "time" || value.optimizationObjective === "distance"
      ? value.optimizationObjective
      : null,
});

const parseHhMm = (value: unknown, fieldName: string): string => {
  if (typeof value !== "string" || !HH_MM_PATTERN.test(value)) {
    throw new HttpError(400, `${fieldName} must use HH:MM 24-hour format.`);
  }
  return value;
};

const timeToMinutes = (value: string) => {
  const [h, m] = value.split(":");
  return Number(h) * 60 + Number(m);
};

const validateWorkingHours = (value: unknown): WeeklyWorkingHours | null => {
  if (value === null) return null;
  if (typeof value !== "object" || value === null) {
    throw new HttpError(400, "workingHours must be an object or null.");
  }

  const days = [
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
    "sunday",
  ] as const;
  const result: WeeklyWorkingHours = {};

  for (const day of days) {
    const dayValue = (value as Record<string, unknown>)[day];
    if (dayValue === undefined) continue;

    if (typeof dayValue !== "object" || dayValue === null) {
      throw new HttpError(400, `workingHours.${day} must be an object.`);
    }

    const d = dayValue as Record<string, unknown>;
    if (typeof d.enabled !== "boolean") {
      throw new HttpError(400, `workingHours.${day}.enabled must be a boolean.`);
    }

    const start = parseHhMm(d.start, `workingHours.${day}.start`);
    const end = parseHhMm(d.end, `workingHours.${day}.end`);

    if (timeToMinutes(end) <= timeToMinutes(start)) {
      throw new HttpError(400, `workingHours.${day}.end must be after start.`);
    }

    const daySchedule: WeeklyWorkingHours[typeof day] = { enabled: d.enabled, start, end };

    if (d.lunchBreak !== undefined) {
      if (typeof d.lunchBreak !== "object" || d.lunchBreak === null) {
        throw new HttpError(400, `workingHours.${day}.lunchBreak must be an object.`);
      }
      const lb = d.lunchBreak as Record<string, unknown>;
      if (typeof lb.enabled !== "boolean") {
        throw new HttpError(400, `workingHours.${day}.lunchBreak.enabled must be a boolean.`);
      }
      if (
        typeof lb.durationMinutes !== "number" ||
        !Number.isInteger(lb.durationMinutes) ||
        lb.durationMinutes < 1
      ) {
        throw new HttpError(
          400,
          `workingHours.${day}.lunchBreak.durationMinutes must be a positive integer.`,
        );
      }
      const workingMinutes = timeToMinutes(end) - timeToMinutes(start);
      if (lb.durationMinutes >= workingMinutes) {
        throw new HttpError(
          400,
          `workingHours.${day}.lunchBreak.durationMinutes must be less than working day length.`,
        );
      }
      const lunchStartTime =
        lb.startTime === undefined
          ? "12:00"
          : parseHhMm(lb.startTime, `workingHours.${day}.lunchBreak.startTime`);
      const lunchStartMinutes = timeToMinutes(lunchStartTime);
      if (
        lunchStartMinutes < timeToMinutes(start) ||
        lunchStartMinutes + lb.durationMinutes > timeToMinutes(end)
      ) {
        throw new HttpError(
          400,
          `workingHours.${day}.lunchBreak.startTime must place lunch within working hours.`,
        );
      }
      daySchedule.lunchBreak = {
        enabled: lb.enabled,
        startTime: lunchStartTime,
        durationMinutes: lb.durationMinutes,
      };
    }

    result[day] = daySchedule;
  }

  return result;
};

const validateAndNormalizeHomeAddress = (value: unknown): string => {
  if (typeof value !== "string") {
    throw new HttpError(400, "homeAddress must be a string.");
  }

  const homeAddress = value.trim();
  if (!homeAddress) {
    throw new HttpError(400, "Home address is required.");
  }

  if (homeAddress.length > MAX_HOME_ADDRESS_LENGTH) {
    throw new HttpError(400, "Home address must be 200 characters or fewer.");
  }

  return homeAddress;
};

export async function OPTIONS(request: Request) {
  let corsHeaders: Record<string, string> | undefined;

  try {
    corsHeaders = buildCorsHeaders(request, {
      methods: "GET, PATCH, OPTIONS",
      allowedHeaders: "Content-Type, Authorization",
      originPolicy: "strict",
      includeSecurityHeaders: true,
    });
    requireSecureAuthTransport(request);

    return new NextResponse(null, {
      status: 204,
      headers: corsHeaders,
    });
  } catch (error) {
    return toErrorResponse(error, "Failed to process preflight request.", corsHeaders);
  }
}

export async function GET(request: Request) {
  let corsHeaders: Record<string, string> | undefined;

  try {
    corsHeaders = buildCorsHeaders(request, {
      methods: "GET, PATCH, OPTIONS",
      allowedHeaders: "Content-Type, Authorization",
      originPolicy: "strict",
      includeSecurityHeaders: true,
    });
    requireSecureAuthTransport(request);

    const auth = await requireAuth(request);
    const nurse = await findNurseById(auth.nurseId);
    if (!nurse || !nurse.isActive) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401, headers: corsHeaders });
    }

    return NextResponse.json(
      {
        user: toAuthUser({
          id: nurse.id,
          email: nurse.email,
          displayName: nurse.displayName,
          homeAddress: nurse.homeAddress,
          workingHours: nurse.workingHours as WeeklyWorkingHours | null | undefined,
          breakGapThresholdMinutes: nurse.breakGapThresholdMinutes,
          optimizationObjective: nurse.optimizationObjective,
        }),
      },
      { headers: corsHeaders },
    );
  } catch (error) {
    return toErrorResponse(error, "Failed to resolve current user.", corsHeaders);
  }
}

export async function PATCH(request: Request) {
  let corsHeaders: Record<string, string> | undefined;

  try {
    corsHeaders = buildCorsHeaders(request, {
      methods: "GET, PATCH, OPTIONS",
      allowedHeaders: "Content-Type, Authorization",
      originPolicy: "strict",
      includeSecurityHeaders: true,
    });
    requireSecureAuthTransport(request);

    const auth = await requireAuth(request);
    let nurse = await findNurseById(auth.nurseId);
    if (!nurse || !nurse.isActive) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401, headers: corsHeaders });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new HttpError(400, "Request body must be valid JSON.");
    }

    if (!isUpdateMeRequest(body)) {
      throw new HttpError(400, "Profile payload must include at least one field to update.");
    }

    const payload = body as Record<string, unknown>;

    if (payload.homeAddress !== undefined) {
      const homeAddress = validateAndNormalizeHomeAddress(payload.homeAddress);
      const updated = await updateNurseHomeAddress(auth.nurseId, homeAddress);
      if (!updated || !updated.isActive) {
        return NextResponse.json({ error: "Unauthorized." }, { status: 401, headers: corsHeaders });
      }
      nurse = updated;
    }

    if (payload.workingHours !== undefined || payload.breakGapThresholdMinutes !== undefined) {
      const workingHours =
        payload.workingHours !== undefined ? validateWorkingHours(payload.workingHours) : undefined;

      let breakGapThresholdMinutes: number | null | undefined = undefined;
      if (payload.breakGapThresholdMinutes !== undefined) {
        if (payload.breakGapThresholdMinutes === null) {
          breakGapThresholdMinutes = null;
        } else if (
          typeof payload.breakGapThresholdMinutes !== "number" ||
          !Number.isInteger(payload.breakGapThresholdMinutes) ||
          payload.breakGapThresholdMinutes < 1
        ) {
          throw new HttpError(400, "breakGapThresholdMinutes must be a positive integer or null.");
        } else {
          breakGapThresholdMinutes = payload.breakGapThresholdMinutes;
        }
      }

      const updated = await updateNurseWorkingHours(
        auth.nurseId,
        workingHours,
        breakGapThresholdMinutes,
      );
      if (!updated || !updated.isActive) {
        return NextResponse.json({ error: "Unauthorized." }, { status: 401, headers: corsHeaders });
      }
      nurse = updated;
    }

    if (payload.optimizationObjective !== undefined) {
      const obj = payload.optimizationObjective;
      if (obj !== null && obj !== "time" && obj !== "distance") {
        throw new HttpError(400, 'optimizationObjective must be "time", "distance", or null.');
      }
      const updated = await updateNurseOptimizationObjective(
        auth.nurseId,
        obj as "time" | "distance" | null,
      );
      if (!updated || !updated.isActive) {
        return NextResponse.json({ error: "Unauthorized." }, { status: 401, headers: corsHeaders });
      }
      nurse = updated;
    }

    return NextResponse.json(
      {
        user: toAuthUser({
          id: nurse.id,
          email: nurse.email,
          displayName: nurse.displayName,
          homeAddress: nurse.homeAddress,
          workingHours: nurse.workingHours as WeeklyWorkingHours | null | undefined,
          breakGapThresholdMinutes: nurse.breakGapThresholdMinutes,
          optimizationObjective: nurse.optimizationObjective,
        }),
      },
      { headers: corsHeaders },
    );
  } catch (error) {
    return toErrorResponse(error, "Failed to update current user.", corsHeaders);
  }
}
