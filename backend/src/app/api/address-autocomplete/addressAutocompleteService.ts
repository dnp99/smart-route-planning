import type { AddressAutocompleteResponse } from "../../../../../shared/contracts";
import {
  enforceRateLimit,
  getCachedSuggestions,
  resolveClientKey,
  setCachedSuggestions,
} from "./cacheAndRateLimit";
import { MIN_QUERY_LENGTH } from "./constants";
import { fetchAutocompleteSuggestions } from "./googlePlacesClient";
import { parseAndValidateQuery } from "./validation";

export const getAddressAutocompleteResponse = async (
  request: Request,
  googleMapsApiKey: string,
): Promise<AddressAutocompleteResponse> => {
  const query = parseAndValidateQuery(request);

  if (query.length < MIN_QUERY_LENGTH) {
    return { suggestions: [] };
  }

  const cachedSuggestions = getCachedSuggestions(query);
  if (cachedSuggestions) {
    return { suggestions: cachedSuggestions };
  }

  const clientKey = resolveClientKey(request);
  enforceRateLimit(clientKey);

  const suggestions = await fetchAutocompleteSuggestions(query, googleMapsApiKey);
  setCachedSuggestions(query, suggestions);

  return { suggestions };
};
