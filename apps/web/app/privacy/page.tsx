import type { Metadata } from "next";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";

export const metadata: Metadata = { title: "Privacy" };

export default function PrivacyPage() {
  return (
    <>
      <SiteHeader />
      <main className="container-page max-w-2xl py-16">
        <h1 className="text-3xl font-extrabold tracking-tight">Privacy</h1>
        <p className="mt-2 text-sm text-ink/50">Draft. The full policy is finalised before pilots go live.</p>
        <div className="mt-8 space-y-5 leading-relaxed text-ink/75">
          <p>
            Swagat AI processes chat messages and phone numbers only to answer questions and manage appointments
            on behalf of the business you are chatting with.
          </p>
          <p>
            Each business's data is stored separately and is never shared with other businesses or used to train AI
            models.
          </p>
          <p>
            You can ask the business, or us, to delete your conversation and contact details at any time, in line
            with India's Digital Personal Data Protection Act, 2023.
          </p>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
