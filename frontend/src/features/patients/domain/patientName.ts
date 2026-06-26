const normalizeWhitespace = (value: string) => value.trim().replace(/\s+/g, " ");

const capitalizeWord = (word: string) => {
  if (!word) {
    return "";
  }

  return `${word[0].toUpperCase()}${word.slice(1).toLowerCase()}`;
};

export const formatNameWords = (value: string) => {
  const normalized = normalizeWhitespace(value);
  if (!normalized) {
    return "";
  }

  return normalized
    .split(" ")
    .map((word) => capitalizeWord(word))
    .join(" ");
};

export const formatPatientNameFromParts = (firstName: string, lastName: string) =>
  [formatNameWords(firstName), formatNameWords(lastName)]
    .filter((part) => part.length > 0)
    .join(" ");

/**
 * Two-letter avatar initials: first letters of the first and last name, falling
 * back to the first two letters of whichever name exists ("?" when neither).
 */
export const getPatientInitials = (firstName: string, lastName: string) => {
  const first = normalizeWhitespace(firstName);
  const last = normalizeWhitespace(lastName);

  if (first && last) {
    return `${first[0]}${last[0]}`.toUpperCase();
  }

  const single = first || last;
  return single ? single.slice(0, 2).toUpperCase() : "?";
};
