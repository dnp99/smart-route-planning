import { NextResponse } from "next/server";

type CorsOriginPolicy = "fallback-first" | "strict";

type BuildCorsHeadersOptions = {
  methods: string;
  allowedHeaders?: string;
  originPolicy?: CorsOriginPolicy;
  includeSecurityHeaders?: boolean;
};

type BuildSecurityHeadersOptions = {
  includeHsts?: boolean;
};

export class HttpError extends Error {
  status: number;
  headers?: Record<string, string>;

  constructor(status: number, message: string, options?: { headers?: Record<string, string> }) {
    super(message);
    this.status = status;
    this.headers = options?.headers;
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
    if (originPolicy === "strict") {
      throw new HttpError(500, "Server is missing ALLOWED_ORIGINS configuration.");
    }

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

const requestUsesHttps = (request: Request) => {
  const forwardedProto = request.headers.get("x-forwarded-proto")?.trim().toLowerCase();
  if (forwardedProto) {
    const firstProto = forwardedProto.split(",")[0]?.trim();
    if (firstProto) {
      return firstProto === "https";
    }
  }

  try {
    return new URL(request.url).protocol === "https:";
  } catch {
    return false;
  }
};

export const buildSecurityHeaders = (
  request: Request,
  { includeHsts = true }: BuildSecurityHeadersOptions = {},
) => {
  const headers: Record<string, string> = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  };

  if (includeHsts && requestUsesHttps(request)) {
    headers["Strict-Transport-Security"] =
      "max-age=31536000; includeSubDomains; preload";
  }

  return headers;
};

export const buildCorsHeaders = (
  request: Request,
  {
    methods,
    allowedHeaders = "Content-Type",
    originPolicy = "fallback-first",
    includeSecurityHeaders = false,
  }: BuildCorsHeadersOptions,
) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": resolveAllowedOrigin(request, originPolicy),
    "Access-Control-Allow-Methods": methods,
    "Access-Control-Allow-Headers": allowedHeaders,
  };

  if (!includeSecurityHeaders) {
    return corsHeaders;
  }

  return {
    ...corsHeaders,
    ...buildSecurityHeaders(request),
  };
};

export const toErrorResponse = (
  error: unknown,
  fallbackMessage: string,
  headers?: Record<string, string>,
) => {
  if (error instanceof HttpError) {
    const mergedHeaders =
      headers || error.headers
        ? {
            ...(headers ?? {}),
            ...(error.headers ?? {}),
          }
        : undefined;

    return NextResponse.json(
      { error: error.message },
      { status: error.status, headers: mergedHeaders },
    );
  }

  return NextResponse.json({ error: fallbackMessage }, { status: 500, headers });
};
