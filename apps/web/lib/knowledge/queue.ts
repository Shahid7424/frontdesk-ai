import "server-only";
import { after } from "next/server";
import { inngest, isInngestConfigured } from "@/lib/inngest/client";
import { ingestDocument, markFailed } from "./ingest";
import { reportError } from "@/lib/monitoring";

/**
 * Starts ingestion for a document without making the owner wait.
 *
 * With Inngest configured (INNGEST_DEV=1 locally, or keys on Vercel) the
 * job runs there, with retries and a run history. Without it, the job runs
 * in this server right after the response is sent: zero setup for local
 * development, one attempt, and the document shows "Failed" with a Retry
 * button if it doesn't work.
 */
export async function enqueueIngest(businessId: string, documentId: string) {
  if (isInngestConfigured) {
    try {
      await inngest.send({ name: "knowledge/document.uploaded", data: { businessId, documentId } });
      return;
    } catch (err) {
      reportError("[ingest] could not reach Inngest, processing inline", (err as Error).message);
    }
  }
  after(async () => {
    try {
      await ingestDocument(businessId, documentId);
    } catch (err) {
      await markFailed(businessId, documentId, err);
    }
  });
}
