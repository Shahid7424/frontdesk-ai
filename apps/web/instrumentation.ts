import * as Sentry from "@sentry/nextjs";
import { privateDataCollection } from "@/lib/sentry-options";

/**
 * Error monitoring for the server. Off unless SENTRY_DSN is set, so local
 * development and tests never send anything.
 */
export async function register() {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;
  Sentry.init({
    dsn,
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
    // Errors only: no performance tracing, which would eat the free quota.
    tracesSampleRate: 0,
    dataCollection: privateDataCollection,
  });
}

/** Errors thrown while rendering pages, route handlers and server actions. */
export const onRequestError = Sentry.captureRequestError;
