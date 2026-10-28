"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getBusinessContext } from "@/lib/data/business";
import { createClient } from "@/lib/supabase/server";
import { reportError } from "@/lib/monitoring";

export type ActionResult = { ok: true } | { ok: false; error: string };

const PAGE = "/dashboard/inbox";
const id = z.string().uuid();

/**
 * The signed-in owner's business. Writes go through their own Supabase
 * client, so RLS decides which conversations they can touch.
 */
async function owner() {
  const ctx = await getBusinessContext();
  // Demo mode has no database; the inbox just updates on screen.
  if (ctx.mode === "demo") return { demo: true as const };
  if (!ctx.user || !ctx.business) return { error: { ok: false, error: "Please log in again." } as ActionResult };
  return { businessId: ctx.business.id, supabase: await createClient() };
}

/**
 * Sends the owner's reply. The widget picks it up within a few seconds,
 * and the conversation moves to "human" so the AI stays quiet.
 */
export async function sendReply(conversationId: string, text: string): Promise<ActionResult> {
  const content = text.trim();
  if (!id.safeParse(conversationId).success || !content || content.length > 2000) {
    return { ok: false, error: "Reply must be 1 to 2000 characters." };
  }
  const o = await owner();
  if ("demo" in o) return { ok: true };
  if ("error" in o) return o.error!;

  const { error } = await o.supabase.from("messages").insert({
    business_id: o.businessId,
    conversation_id: conversationId,
    role: "owner",
    content,
  });
  if (error) {
    reportError("[inbox] reply failed", error);
    return { ok: false, error: "Couldn't send. Please try again." };
  }
  await o.supabase
    .from("conversations")
    .update({ status: "human", last_message_at: new Date().toISOString() })
    .eq("id", conversationId)
    .eq("business_id", o.businessId);
  revalidatePath(PAGE);
  return { ok: true };
}

const STATUSES = ["ai", "human", "resolved"] as const;

/** Take over (human), hand back to the AI (ai), or close (resolved). */
export async function setConversationStatus(conversationId: string, status: (typeof STATUSES)[number]): Promise<ActionResult> {
  if (!id.safeParse(conversationId).success || !STATUSES.includes(status)) return { ok: false, error: "Invalid request." };
  const o = await owner();
  if ("demo" in o) return { ok: true };
  if ("error" in o) return o.error!;

  const { error } = await o.supabase
    .from("conversations")
    .update({ status })
    .eq("id", conversationId)
    .eq("business_id", o.businessId);
  if (error) {
    reportError("[inbox] status change failed", error);
    return { ok: false, error: "Couldn't update. Please try again." };
  }
  revalidatePath(PAGE);
  return { ok: true };
}
