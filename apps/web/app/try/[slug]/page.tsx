import { MessageCircle } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Script from "next/script";
import { LogoMark } from "@/components/ui/logo";
import { isSupabaseConfigured } from "@/lib/env";
import { createServiceClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Try your widget", robots: { index: false } };

/**
 * A blank page with one business's widget, embedded with the same script
 * tag a customer pastes on their site. The slug is the public widget id,
 * so this page shows nothing that the widget itself doesn't.
 */
export default async function TryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!isSupabaseConfigured || !/^[a-z0-9-]{1,64}$/.test(slug)) notFound();
  const { data: business } = await createServiceClient()
    .from("businesses")
    .select("name, area")
    .eq("slug", slug)
    .maybeSingle();
  if (!business) notFound();

  return (
    <main className="grid min-h-dvh place-items-center bg-[#fbfaf7] px-4 py-16">
      <div className="max-w-md text-center">
        <Link href="/dashboard" aria-label="Back to dashboard" className="inline-block">
          <LogoMark className="mx-auto size-10" />
        </Link>
        <h1 className="mt-6 text-2xl font-extrabold tracking-tight">{business.name}</h1>
        {business.area && <p className="mt-1 text-sm text-slate-500">{business.area}</p>}
        <p className="mt-6 text-slate-600">
          This is how your AI receptionist looks on a website. Open the chat bubble at the bottom right and ask what
          your customers would ask.
        </p>
        <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm text-slate-600 ring-1 ring-black/5">
          <MessageCircle className="size-4 text-brand-600" />
          Try: &ldquo;Kal appointment chahiye&rdquo;
        </p>
      </div>
      <Script src="/widget.js" data-business-id={slug} strategy="afterInteractive" />
    </main>
  );
}
