import { NextResponse } from "next/server";
import { HttpError, buildCorsHeaders, toErrorResponse } from "../../../lib/http";

type AutocompleteSuggestion = {
  displayName: string;
  placeId: string;
};

const MAX_QUERY_LENGTH = 200;
const MAX_SUGGESTIONS = 5;
const AUTOCOMPLETE_TIMEOUT_MS = 8000;
const MIN_QUERY_LENGTH = 3;
const CACHE_TTL_MS = 60_000;
const RATE_LIMIT_WINDOW_MS = 1_000;

const queryCache = new Map<string, { suggestions: AutocompleteSuggestion[]; expiresAt: number }>();
const lastRequestAtByClient = new Map<string, number>();

const parseAndValidateQuery = (request: Request) => {
  const url = new URL(request.url);
  const rawQuery = url.searchParams.get("query") ?? "";
  const query = rawQuery.trim();

  if (query.length > MAX_QUERY_LENGTH) {
    throw new HttpError(400, `Query must be at most ${MAX_QUERY_LENGTH} characters.`);
  }

  return query;
};

const normalizeQueryKey = (query: string) => query.trim().toLowerCase();

const getCachedSuggestions = (query: string) => {
  const now = Date.now();
  const cacheKey = normalizeQueryKey(query);
  const cached = queryCache.get(cacheKey);

  if (!cached) {
    return null;
  }

  if (cached.expiresAt <= now) {
    queryCache.delete(cacheKey);
    return null;
  }

  return cached.suggestions;
};

const setCachedSuggestions = (query: string, suggestions: AutocompleteSuggestion[]) => {
  const cacheKey = normalizeQueryKey(query);
  queryCache.set(cacheKey, {
    suggestions,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
};

const resolveClientKey = (request: Request) => {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const firstIp = forwardedFor.split(",")[0]?.trim();
    if (firstIp) {
      return firstIp;
    }
  }

  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) {
    return realIp;
  }

  return "anonymous";
};

const enforceRateLimit = (clientKey: string) => {
  const now = Date.now();
  const lastRequestAt = lastRequestAtByClient.get(clientKey) ?? 0;

  if (now - lastRequestAt < RATE_LIMIT_WINDOW_MS) {
    throw new HttpError(429, "Please wait before requesting more address suggestions.");
  }

  lastRequestAtByClient.set(clientKey, now);
};

const fetchAutocompleteSuggestions = async (
  query: string,
  apiKey: string,
): Promise<AutocompleteSuggestion[]> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, AUTOCOMPLETE_TIMEOUT_MS);

  let response: Response;

  try {
    response = await fetch("https://places.googleapis.com/v1/places:autocomplete", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask":
          "suggestions.placePrediction.placeId,suggestions.placePrediction.text.text",
      },
      body: JSON.stringify({
        input: query,
        includedRegionCodes: ["ca"],
        regionCode: "ca",
      }),
      cache: "no-store",
      signal: controller.signal,
    });
  } catch {
    throw new HttpError(503, "Address suggestion service is currently unavailable.");
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new HttpError(500, "Google Places API key is invalid or not authorized.");
    }

    if (response.status === 429) {
      throw new HttpError(503, "Address suggestion service is rate-limited. Please try again shortly.");
    }

    throw new HttpError(503, "Address suggestion service returned an unexpected error.");
  }

  const payload = (await response.json()) as {
    suggestions?: Array<{
      placePrediction?: {
        placeId?: unknown;
        text?: {
          text?: unknown;
        };
      };
    }>;
  };

  if (!Array.isArray(payload.suggestions)) {
    throw new HttpError(503, "Address suggestion service returned an invalid response.");
  }

  const suggestions: AutocompleteSuggestion[] = [];

  payload.suggestions.slice(0, MAX_SUGGESTIONS).forEach((item) => {
    const placePrediction = item.placePrediction;
    const displayName = placePrediction?.text?.text;
    const placeId = placePrediction?.placeId;

    if (typeof displayName !== "string" || typeof placeId !== "string") {
      return;
    }

    suggestions.push({
      displayName,
      placeId,
    });
  });

  return suggestions;
};

export async function OPTIONS(request: Request) {
  try {
    const corsHeaders = buildCorsHeaders(request, {
      methods: "GET, OPTIONS",
      originPolicy: "strict",
    });

    return new NextResponse(null, {
      status: 204,
      headers: corsHeaders,
    });
  } catch (error) {
    return toErrorResponse(error, "Failed to process preflight request.");
  }
}

export async function GET(request: Request) {
  let corsHeaders: Record<string, string> | undefined;

  try {
    corsHeaders = buildCorsHeaders(request, {
      methods: "GET, OPTIONS",
      originPolicy: "strict",
    });

    const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY?.trim();
    if (!googleMapsApiKey) {
      return NextResponse.json(
        { error: "Server is missing GOOGLE_MAPS_API_KEY configuration." },
        { status: 500, headers: corsHeaders },
      );
    }

    const query = parseAndValidateQuery(request);

    if (query.length < MIN_QUERY_LENGTH) {
      return NextResponse.json({ suggestions: [] }, { headers: corsHeaders });
    }

    const cachedSuggestions = getCachedSuggestions(query);
    if (cachedSuggestions) {
      return NextResponse.json({ suggestions: cachedSuggestions }, { headers: corsHeaders });
    }

    const clientKey = resolveClientKey(request);
    enforceRateLimit(clientKey);

    const suggestions = await fetchAutocompleteSuggestions(query, googleMapsApiKey);
    setCachedSuggestions(query, suggestions);

    return NextResponse.json({ suggestions }, { headers: corsHeaders });
  } catch (error) {
    return toErrorResponse(error, "Failed to fetch address suggestions.", corsHeaders);
  }
}
