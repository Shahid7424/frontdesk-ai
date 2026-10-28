import * as Sentry from "@sentry/nextjs";
import { privateDataCollection } from "@/lib/sentry-options";

// Browser errors in the dashboard and payment page. Off without the public DSN.
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
if (dsn) {
  Sentry.init({ dsn, tracesSampleRate: 0, dataCollection: privateDataCollection });
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
