import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest/client";
import { ingestDocumentFn } from "@/lib/inngest/functions";

export const runtime = "nodejs";
// PDF parsing + embeddings for a large file can take a while.
export const maxDuration = 60;

export const { GET, POST, PUT } = serve({ client: inngest, functions: [ingestDocumentFn] });
