/**
 * Normalize a value to MySQL DATE format (YYYY-MM-DD).
 * Accepts Date, YYYY-MM-DD, or ISO datetime strings.
 * Returns undefined when input is undefined (skip field);
 * returns null for empty/invalid optional clears.
 */
export function toMysqlDate(value) {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return value.toISOString().slice(0, 10);
  }

  const str = String(value).trim();
  const match = str.match(/^(\d{4}-\d{2}-\d{2})/);
  if (match) return match[1];

  const parsed = new Date(str);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}
