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
