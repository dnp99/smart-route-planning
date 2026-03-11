const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

export type AddressSuggestion = {
  displayName: string;
  placeId: string;
};

export type AddressAutocompleteResponse = {
  suggestions: AddressSuggestion[];
};

export const isAddressSuggestion = (value: unknown): value is AddressSuggestion => {
  if (!isObject(value)) {
    return false;
  }

  return typeof value.displayName === "string" && typeof value.placeId === "string";
};

export const parseAddressAutocompleteResponse = (
  payload: unknown,
  maxSuggestions = Number.POSITIVE_INFINITY,
) => {
  if (!isObject(payload) || !Array.isArray(payload.suggestions)) {
    return [];
  }

  return payload.suggestions
    .filter(isAddressSuggestion)
    .slice(0, maxSuggestions);
};

export const isAddressAutocompleteResponse = (
  payload: unknown,
): payload is AddressAutocompleteResponse => {
  if (!isObject(payload) || !Array.isArray(payload.suggestions)) {
    return false;
  }

  return payload.suggestions.every(isAddressSuggestion);
};
