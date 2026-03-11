import { HttpError } from "../../../lib/http";
import {
  isAddressSuggestion,
  type AddressSuggestion,
} from "../../../../../shared/contracts";
import { AUTOCOMPLETE_TIMEOUT_MS, MAX_SUGGESTIONS } from "./constants";

type PlacesAutocompletePayload = {
  suggestions?: Array<{
    placePrediction?: {
      placeId?: unknown;
      text?: {
        text?: unknown;
      };
    };
  }>;
};

const mapPlacesPayloadToSuggestions = (payload: PlacesAutocompletePayload): AddressSuggestion[] => {
  if (!Array.isArray(payload.suggestions)) {
    throw new HttpError(503, "Address suggestion service returned an invalid response.");
  }

  return payload.suggestions
    .slice(0, MAX_SUGGESTIONS)
    .map((item) => ({
      displayName: item.placePrediction?.text?.text,
      placeId: item.placePrediction?.placeId,
    }))
    .filter(isAddressSuggestion);
};

export const fetchAutocompleteSuggestions = async (
  query: string,
  apiKey: string,
): Promise<AddressSuggestion[]> => {
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

  const payload = (await response.json()) as PlacesAutocompletePayload;
  return mapPlacesPayloadToSuggestions(payload);
};
