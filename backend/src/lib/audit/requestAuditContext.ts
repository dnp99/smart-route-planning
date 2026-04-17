export const resolveRequestIpAddress = (request: Request): string | null =>
  request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;

export const resolveRequestUserAgent = (request: Request): string | null =>
  request.headers.get("user-agent")?.trim() ?? null;
