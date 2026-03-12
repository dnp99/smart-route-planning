import { getDatabaseUrl } from "../../db";
import { HttpError } from "../http";
import { findNurseByExternalKey } from "./patientRepository";

export type NurseContext = {
  nurseId: string;
  nurseExternalKey: string;
};

export const resolveNurseContext = async (): Promise<NurseContext> => {
  try {
    getDatabaseUrl();
  } catch {
    throw new HttpError(500, "Server is missing DATABASE_URL configuration.");
  }

  const defaultNursePoc = process.env.DEFAULT_NURSE_POC?.trim();
  if (defaultNursePoc !== "true") {
    throw new HttpError(500, "Patient endpoints are unsupported unless DEFAULT_NURSE_POC=true.");
  }

  const defaultNurseExternalKey = process.env.DEFAULT_NURSE_ID?.trim();
  if (!defaultNurseExternalKey) {
    throw new HttpError(500, "Server is missing DEFAULT_NURSE_ID configuration.");
  }

  const nurse = await findNurseByExternalKey(defaultNurseExternalKey);
  if (!nurse) {
    throw new HttpError(
      500,
      `Configured DEFAULT_NURSE_ID '${defaultNurseExternalKey}' was not found in nurses table.`,
    );
  }

  return {
    nurseId: nurse.id,
    nurseExternalKey: nurse.externalKey,
  };
};
