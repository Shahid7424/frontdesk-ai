import { Inngest } from "inngest";

/**
 * Background jobs. Locally: run `npx inngest-cli@latest dev` and set
 * INNGEST_DEV=1. On Vercel: install the Inngest integration, which sets
 * INNGEST_EVENT_KEY and INNGEST_SIGNING_KEY.
 */
export const isInngestConfigured = Boolean(process.env.INNGEST_EVENT_KEY || process.env.INNGEST_DEV);

export const inngest = new Inngest({ id: "frontdesk-ai" });
