/** Display-only masking. Does not alter stored phone numbers. */
export function maskedPhone(value?: string | null) {
  const digits = (value || '').replace(/\D/g, '');
  if (!digits) return '—';
  if (digits.length <= 3) return '***';
  return '*'.repeat(digits.length - 3) + digits.slice(-3);
}
