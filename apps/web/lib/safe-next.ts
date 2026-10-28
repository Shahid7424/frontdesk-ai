/**
 * Where to go after login: only a path on this site. Browsers read "\" as
 * "/" and drop tabs and newlines, so "/\evil.com" or "/\t/evil.com" would
 * leave the site; anything but plain path characters falls back.
 */
export function safeNext(value: string | null | undefined, fallback = "/dashboard"): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return fallback;
  if (!/^\/[\w\-.~%!$&'()*+,;=:@/?#]*$/.test(value)) return fallback;
  return value;
}
