import type { Metadata } from "next";
import { Suspense } from "react";
import { Inbox } from "@/components/dashboard/inbox";
import { getBusinessContext } from "@/lib/data/business";
import { getConversations } from "@/lib/data/dashboard";

export const metadata: Metadata = { title: "Inbox" };
export const dynamic = "force-dynamic";

export default async function InboxPage() {
  const { items, sample } = await getConversations(await getBusinessContext());
  return (
    <Suspense>
      <Inbox initial={items} sample={sample} />
    </Suspense>
  );
}
