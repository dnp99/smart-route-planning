import type {
  CreateRecurringVisitTemplateRequest,
  RecurringVisitTemplate,
  UpdateRecurringVisitTemplateRequest,
} from "../../../../../shared/contracts";
import {
  isRecurringVisitTemplate,
  parseListRecurringVisitTemplatesResponse,
} from "../../../../../shared/contracts";
import { requestAuthedJson } from "../../../components/auth/authFetch";

const requestJson = async (path: string, init: RequestInit, fallbackMessage: string) =>
  requestAuthedJson(path, init, fallbackMessage);

export const listRecurringVisitTemplates = async (
  patientId?: string,
): Promise<RecurringVisitTemplate[]> => {
  const searchParams = new URLSearchParams();
  if (typeof patientId === "string" && patientId.trim().length > 0) {
    searchParams.set("patientId", patientId.trim());
  }

  const querySuffix = searchParams.toString();
  const path = querySuffix
    ? `/api/recurring-visit-templates?${querySuffix}`
    : "/api/recurring-visit-templates";
  const payload = await requestJson(path, { method: "GET" }, "Unable to load recurring templates.");

  return parseListRecurringVisitTemplatesResponse(payload).templates;
};

export const createRecurringVisitTemplate = async (
  request: CreateRecurringVisitTemplateRequest,
): Promise<RecurringVisitTemplate> => {
  const payload = await requestJson(
    "/api/recurring-visit-templates",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    },
    "Unable to create recurring template.",
  );

  if (!isRecurringVisitTemplate(payload)) {
    throw new Error("Unexpected recurring template response format.");
  }

  return payload;
};

export const updateRecurringVisitTemplate = async (
  templateId: string,
  request: UpdateRecurringVisitTemplateRequest,
): Promise<RecurringVisitTemplate> => {
  const payload = await requestJson(
    `/api/recurring-visit-templates/${encodeURIComponent(templateId)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    },
    "Unable to update recurring template.",
  );

  if (!isRecurringVisitTemplate(payload)) {
    throw new Error("Unexpected recurring template response format.");
  }

  return payload;
};

export const deleteRecurringVisitTemplate = async (templateId: string): Promise<void> => {
  await requestJson(
    `/api/recurring-visit-templates/${encodeURIComponent(templateId)}`,
    {
      method: "DELETE",
    },
    "Unable to delete recurring template.",
  );
};
