import type { Metadata } from "next";
import { Documents } from "@/components/dashboard/documents";
import { PageHeader } from "@/components/dashboard/page-header";
import { QuickAnswers } from "@/components/dashboard/quick-answers";
import { TestAi } from "@/components/dashboard/test-ai";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { getBusinessContext } from "@/lib/data/business";
import { getKnowledgeBase } from "@/lib/data/knowledge";
import { embedder } from "@/lib/knowledge/embedder";

export const metadata: Metadata = { title: "Knowledge base" };
// Without Inngest, an uploaded PDF is read and embedded right after this page's action responds.
export const maxDuration = 60;

export default async function KnowledgePage() {
  const ctx = await getBusinessContext();
  const { documents, quickAnswers } = await getKnowledgeBase(ctx);
  const canEmbed = embedder !== null;

  return (
    <div className="container-page space-y-6 py-8">
      <PageHeader
        title="Knowledge base"
        description="The AI answers only from what's here. If something is missing, it hands the chat to you."
        actions={
          ctx.mode === "live" && (
            <Badge tone={canEmbed ? "green" : "neutral"}>{canEmbed ? "Smart search on" : "Keyword search"}</Badge>
          )
        }
      />

      <Card>
        <CardHeader title="Test your AI" description="Ask what a customer would ask and see the sources it used." />
        <TestAi businessId={ctx.business!.slug} />
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader title="Documents" description="PDFs the AI has learned from." />
          <Documents docs={documents} canEmbed={canEmbed} live={ctx.mode === "live"} />
        </Card>

        <Card>
          <QuickAnswers items={quickAnswers} />
        </Card>
      </div>
    </div>
  );
}
