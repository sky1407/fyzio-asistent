export type Redactor = (text: string) => string;

export const PATIENT_PLACEHOLDER = "Pacient";
export const BIRTH_NUMBER_PLACEHOLDER = "[RODNÉ ČÍSLO]";
export const PHONE_PLACEHOLDER = "[TELEFÓN]";
export const EMAIL_PLACEHOLDER = "[E-MAIL]";

const EMAIL = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;
// Slovak birth number: 6 digits, slash, 3 or 4 digits (e.g. 860515/1234).
const BIRTH_NUMBER = /\b\d{6}\s?\/\s?\d{3,4}\b/g;
// Phone with an explicit prefix (+421, 00421 or a leading 0) and 8 to 10 further digits.
const PHONE = /(?:\+421|00421|0)(?:[\s./-]?\d){8,10}\b/g;

// Slovak case endings a first name or surname stem can take.
const NAME_SUFFIXES = new Set([
  "", "a", "e", "i", "o", "u", "y", "om", "ou", "ovi", "ej", "ov", "ova", "ove",
  "ovu", "ovou", "ovej", "ych", "ym", "ymi", "ami", "och", "mi", "iho", "eho", "emu",
]);

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

function stem(name: string): string {
  const normalized = normalize(name);
  if (normalized.length >= 4 && /[aeiouyáäéíóôúý]$/.test(name.toLowerCase())) {
    return normalized.slice(0, -1);
  }
  return normalized;
}

function matchesName(word: string, parts: string[]): boolean {
  const normalized = normalize(word);
  return parts.some((part) => {
    const full = normalize(part);
    if (normalized === full) return true;
    if (full.length < 3) return false;
    const base = stem(part);
    return normalized.startsWith(base) && NAME_SUFFIXES.has(normalized.slice(base.length));
  });
}

function redactPatterns(text: string): string {
  return text
    .replace(EMAIL, EMAIL_PLACEHOLDER)
    .replace(BIRTH_NUMBER, BIRTH_NUMBER_PLACEHOLDER)
    .replace(PHONE, PHONE_PLACEHOLDER);
}

/**
 * Builds a one-way redactor that removes the known patient's name (including common
 * Slovak declensions) and structural personal data before any text reaches an AI provider.
 */
export function buildRedactor(names: Iterable<string> = []): Redactor {
  const parts = [...names]
    .flatMap((name) => name.split(/\s+/))
    .map((part) => part.trim())
    .filter((part) => part.length >= 2);

  return (text) => {
    const withoutNames =
      parts.length === 0
        ? text
        : text
            .replace(/\p{L}[\p{L}'-]*/gu, (word) => (matchesName(word, parts) ? PATIENT_PLACEHOLDER : word))
            .replace(new RegExp(`\\b${PATIENT_PLACEHOLDER}(?:\\s+${PATIENT_PLACEHOLDER})+\\b`, "g"), PATIENT_PLACEHOLDER);
    return redactPatterns(withoutNames);
  };
}
