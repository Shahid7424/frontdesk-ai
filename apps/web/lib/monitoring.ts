import * as Sentry from "@sentry/nextjs";

/**
 * Logs an error and, when SENTRY_DSN is set, sends it to Sentry so a
 * failure on the live site reaches us before a clinic calls about it.
 * Takes the same arguments as console.error. Customer messages are never
 * attached: only the label and the error itself leave the server.
 */
export function reportError(label: string, ...details: unknown[]) {
  console.error(label, ...details);
  const err = details.find((d): d is Error => d instanceof Error);
  const note = details.filter((d) => typeof d === "string" || typeof d === "number").join(" ");
  if (err) Sentry.captureException(err, { tags: { area: area(label) }, extra: { label, note } });
  else Sentry.captureMessage(`${label}${note ? ` ${note}` : ""}${pgMessage(details)}`, { level: "error", tags: { area: area(label) } });
}

/** "[chat] agent failed" → "chat" */
const area = (label: string) => /^\[([\w-]+)\]/.exec(label)?.[1] ?? "app";

/** Supabase errors are plain objects with a message. */
const pgMessage = (details: unknown[]) => {
  const e = details.find((d): d is { message: string } => typeof d === "object" && d !== null && typeof (d as { message?: unknown }).message === "string");
  return e ? `: ${e.message}` : "";
};
