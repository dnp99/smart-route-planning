const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

export type ApiErrorResponse = {
  error: string;
};

export const extractApiErrorMessage = (payload: unknown) => {
  if (!isObject(payload)) {
    return null;
  }

  return typeof payload.error === "string" ? payload.error : null;
};
