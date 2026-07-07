export function extractUSNationalPhoneDigits(value: string): string {
  let digits = String(value || "").replace(/\D/g, "");

  while (digits.length > 10 && digits.startsWith("1")) {
    digits = digits.slice(1);
  }

  return digits.slice(0, 10);
}

export function isValidUSNationalPhoneDigits(value: string): boolean {
  return /^[2-9]\d{2}[2-9]\d{6}$/.test(value);
}

export function normalizeUSPhoneE164(value: string): string | null {
  const national = extractUSNationalPhoneDigits(value);
  if (!isValidUSNationalPhoneDigits(national)) return null;
  return `+1${national}`;
}
