import { NextResponse } from "next/server";
import { getAnalyticsSnapshot } from "@/lib/analytics";

class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const resolveAllowedOrigin = (request: Request) => {
  const configuredOrigins = process.env.ALLOWED_ORIGINS
    ?.split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  if (!configuredOrigins || configuredOrigins.length === 0) {
    return "*";
  }

  const requestOrigin = request.headers.get("origin");
  if (!requestOrigin) {
    return configuredOrigins[0];
  }

  if (configuredOrigins.indexOf(requestOrigin) !== -1) {
    return requestOrigin;
  }

  throw new HttpError(403, "Origin is not allowed.");
};

const buildCorsHeaders = (request: Request) => ({
  "Access-Control-Allow-Origin": resolveAllowedOrigin(request),
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-analytics-key",
});

const isAuthorized = (request: Request) => {
  const configuredKey = process.env.ANALYTICS_API_KEY?.trim();

  if (!configuredKey) {
    return true;
  }

  const providedKey = request.headers.get("x-analytics-key")?.trim();
  return providedKey === configuredKey;
};

export async function OPTIONS(request: Request) {
  try {
    return new NextResponse(null, {
      status: 204,
      headers: buildCorsHeaders(request),
    });
  } catch (error) {
    if (error instanceof HttpError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json(
      { error: "Failed to process preflight request." },
      { status: 500 },
    );
  }
}

export async function GET(request: Request) {
  try {
    const corsHeaders = buildCorsHeaders(request);

    if (!isAuthorized(request)) {
      return NextResponse.json(
        { error: "Unauthorized." },
        { status: 401, headers: corsHeaders },
      );
    }

    return NextResponse.json(getAnalyticsSnapshot(), {
      headers: {
        ...corsHeaders,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof HttpError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json({ error: "Failed to load analytics." }, { status: 500 });
  }
}
