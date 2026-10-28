import { CheckCircle2, Clock3, ExternalLink, Globe, MessageCircle } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { AllowedDomains } from "@/components/dashboard/allowed-domains";
import { CopySnippet } from "@/components/dashboard/copy-snippet";
import { PageHeader } from "@/components/dashboard/page-header";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { appOrigin } from "@/lib/app-url";
import { getAllowedDomains, getBusinessContext } from "@/lib/data/business";

export const metadata: Metadata = { title: "Channels" };

export default async function ChannelsPage() {
  const ctx = await getBusinessContext();
  const slug = ctx.business!.slug;
  const origin = await appOrigin();
  const snippet = `<script
  src="${origin}/widget.js"
  data-business-id="${slug}"
  defer
></script>`;
  // Demo mode has no database, so it previews on the sample clinic site.
  const previewHref = ctx.mode === "demo" ? "/demo" : `/try/${slug}`;
  const domains = await getAllowedDomains(ctx);
  // WhatsApp isn't connected for real businesses yet (Day 9), so only the
  // demo shows a setup in progress; everyone else sees the steps ahead.
  const demo = ctx.mode === "demo";
  const whatsappSteps = [
    {
      done: demo,
      title: demo ? "Meta Business account created" : "Create a Meta Business account",
      body: demo ? `Linked to ${ctx.business!.name}.` : "Free, at business.facebook.com. Verification can take a few days, so start early.",
    },
    {
      done: demo,
      title: demo ? "Test number connected" : "Connect a test number",
      body: "Up to 5 verified numbers can chat for testing.",
    },
    { done: false, title: "Business verification", body: "Meta reviews your documents. This usually takes a few days." },
    { done: false, title: "Go live on your own number", body: "Customers chat with the same AI on your WhatsApp number." },
  ];

  return (
    <div className="container-page space-y-6 py-8">
      <PageHeader title="Channels" description="Where your customers can talk to your AI receptionist." />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Website chat"
            description="A chat bubble on your website."
            action={
              <Badge tone="green">
                <CheckCircle2 className="size-3" /> Live
              </Badge>
            }
          />
          <div className="space-y-4 p-5">
            <p className="text-sm text-slate-600">
              Paste this just before <code className="rounded bg-slate-100 px-1 py-0.5 text-[13px]">&lt;/body&gt;</code> on
              every page. Works with WordPress, Wix, Shopify and plain HTML.
            </p>
            <CopySnippet code={snippet} />
            <Link href={previewHref} target="_blank" className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:underline">
              {ctx.mode === "demo" ? "Preview on a sample site" : "Try your widget"} <ExternalLink className="size-3.5" />
            </Link>
            {ctx.mode === "live" && <AllowedDomains initial={domains} />}
          </div>
        </Card>

        <Card>
          <CardHeader
            title="WhatsApp"
            description="Same AI, on your WhatsApp Business number."
            action={
              demo ? (
                <Badge tone="amber">
                  <Clock3 className="size-3" /> Verification pending
                </Badge>
              ) : (
                <Badge tone="neutral">Not connected</Badge>
              )
            }
          />
          <div className="p-5">
            <ol className="space-y-4">
              {whatsappSteps.map((s) => (
                <li key={s.title} className="flex gap-3">
                  <span
                    className={
                      s.done
                        ? "grid size-6 shrink-0 place-items-center rounded-full bg-emerald-500 text-white"
                        : "grid size-6 shrink-0 place-items-center rounded-full border-2 border-dashed border-slate-300"
                    }
                  >
                    {s.done && <CheckCircle2 className="size-4" />}
                  </span>
                  <div>
                    <p className="text-sm font-semibold">{s.title}</p>
                    <p className="text-sm text-slate-500">{s.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </Card>
      </div>

      <Card className="flex flex-col items-start gap-4 p-6 sm:flex-row sm:items-center">
        <div className="flex -space-x-2">
          <span className="grid size-10 place-items-center rounded-full bg-emerald-100 text-emerald-700 ring-2 ring-white">
            <MessageCircle className="size-5" />
          </span>
          <span className="grid size-10 place-items-center rounded-full bg-sky-100 text-sky-700 ring-2 ring-white">
            <Globe className="size-5" />
          </span>
        </div>
        <div className="flex-1">
          <p className="font-semibold">One brain, every channel</p>
          <p className="text-sm text-slate-500">
            Website and WhatsApp share the same knowledge, bookings and inbox. Update a price once, it's right everywhere.
          </p>
        </div>
        <ButtonLink href="/dashboard/knowledge" variant="secondary" size="sm">
          Edit knowledge
        </ButtonLink>
      </Card>
    </div>
  );
}
