// Generates a temporary password for an admin-initiated reset. Excludes visually
// ambiguous characters (0/O, 1/l/I) so it can be read out and typed reliably.
// The nurse is forced to change it on next login (nurses.mustChangePassword).
const ALPHABET = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export const generateTemporaryPassword = (length = 14): string => {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < length; i += 1) {
    out += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return out;
};
