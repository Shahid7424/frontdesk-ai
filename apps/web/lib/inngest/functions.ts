import "server-only";
import { NonRetriableError } from "inngest";
import { ingestDocument, markFailed, PermanentIngestError } from "@/lib/knowledge/ingest";
import { inngest } from "./client";

type IngestEvent = { data: { businessId: string; documentId: string } };

export const ingestDocumentFn = inngest.createFunction(
  {
    id: "ingest-document",
    triggers: [{ event: "knowledge/document.uploaded" }],
    // Embedding rate limits (429) and network blips are retried with backoff.
    retries: 3,
    // One business uploading 20 PDFs shouldn't use up the free embeddings quota for everyone.
    concurrency: { key: "event.data.businessId", limit: 2 },
    // Retries ran out. Permanent errors already saved their own message below.
    onFailure: async ({ event, error }) => {
      if (error.name === "NonRetriableError") return;
      const { businessId, documentId } = (event.data as { event: IngestEvent }).event.data;
      await markFailed(businessId, documentId, error);
    },
  },
  async ({ event, step }) => {
    const { businessId, documentId } = (event as unknown as IngestEvent).data;
    return step.run("extract-chunk-embed-save", async () => {
      try {
        return await ingestDocument(businessId, documentId);
      } catch (err) {
        // A scanned PDF stays scanned: fail now with the real reason instead of retrying.
        if (err instanceof PermanentIngestError) {
          await markFailed(businessId, documentId, err);
          throw new NonRetriableError(err.message);
        }
        throw err;
      }
    });
  },
);
