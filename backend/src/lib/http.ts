import { NextResponse } from "next/server";

type CorsOriginPolicy = "fallback-first" | "strict";

type BuildCorsHeadersOptions = {
  methods: string;
  allowedHeaders?: string;
  originPolicy?: CorsOriginPolicy;
};

export class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const resolveConfiguredOrigins = () =>
  process.env.ALLOWED_ORIGINS
    ?.split(",")
    .map((value) => value.trim())
    .filter(Boolean);

const resolveAllowedOrigin = (request: Request, originPolicy: CorsOriginPolicy) => {
  const configuredOrigins = resolveConfiguredOrigins();

  if (!configuredOrigins || configuredOrigins.length === 0) {
    return "*";
  }

  const requestOrigin = request.headers.get("origin");
  if (requestOrigin && configuredOrigins.indexOf(requestOrigin) !== -1) {
    return requestOrigin;
  }

  if (originPolicy === "strict" && requestOrigin) {
    throw new HttpError(403, "Origin is not allowed.");
  }

  return configuredOrigins[0];
};

export const buildCorsHeaders = (
  request: Request,
  {
    methods,
    allowedHeaders = "Content-Type",
    originPolicy = "fallback-first",
  }: BuildCorsHeadersOptions,
) => ({
  "Access-Control-Allow-Origin": resolveAllowedOrigin(request, originPolicy),
  "Access-Control-Allow-Methods": methods,
  "Access-Control-Allow-Headers": allowedHeaders,
});

export const toErrorResponse = (
  error: unknown,
  fallbackMessage: string,
  headers?: Record<string, string>,
) => {
  if (error instanceof HttpError) {
    return NextResponse.json({ error: error.message }, { status: error.status, headers });
  }

  return NextResponse.json({ error: fallbackMessage }, { status: 500, headers });
};
