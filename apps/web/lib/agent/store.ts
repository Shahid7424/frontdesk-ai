import "server-only";
import type { Json } from "@frontdesk/db";
import { createServiceClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Reuses the widget's conversation if it belongs to this business,
 * otherwise starts a new one. A conversation id from another business is
 * treated as unknown, never reused.
 */
export async function getOrCreateConversation(businessId: string, conversationId?: string) {
  const db = createServiceClient();
  if (conversationId && UUID.test(conversationId)) {
    const { data } = await db
      .from("conversations")
      .select("id, status")
      .eq("id", conversationId)
      .eq("business_id", businessId)
      .maybeSingle();
    if (data) return data;
  }
  const { data, error } = await db
    .from("conversations")
    .insert({ business_id: businessId, channel: "web" })
    .select("id, status")
    .single();
  if (error) throw new Error(`Could not create conversation: ${error.message}`);
  return data;
}

export async function saveMessage(input: {
  businessId: string;
  conversationId: string;
  role: "customer" | "ai";
  content: string;
  metadata?: Json;
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  costUsd?: number;
}) {
  const db = createServiceClient();
  const { error } = await db.from("messages").insert({
    business_id: input.businessId,
    conversation_id: input.conversationId,
    role: input.role,
    content: input.content,
    metadata: input.metadata ?? {},
    model: input.model ?? null,
    input_tokens: input.inputTokens ?? null,
    output_tokens: input.outputTokens ?? null,
    cost_usd: input.costUsd ?? null,
  });
  if (error) throw new Error(`Could not save message: ${error.message}`);
}

/** Bumps last_message_at, adds this reply's cost, and flags handoffs for the inbox. */
export async function touchConversation(businessId: string, conversationId: string, addCostUsd: number, needsHuman: boolean) {
  const db = createServiceClient();
  const { data } = await db
    .from("conversations")
    .select("cost_usd, status")
    .eq("id", conversationId)
    .eq("business_id", businessId)
    .single();
  await db
    .from("conversations")
    .update({
      last_message_at: new Date().toISOString(),
      cost_usd: Number(data?.cost_usd ?? 0) + addCostUsd,
      ...(needsHuman && data?.status === "ai" ? { status: "needs_human" as const } : {}),
    })
    .eq("id", conversationId)
    .eq("business_id", businessId);
  // True when this call is what put the chat in front of the team.
  return needsHuman && data?.status === "ai";
}

/**
 * The last turns of a conversation from the database, oldest first. The
 * model sees what we stored, never history the browser claims happened.
 */
export async function loadHistory(businessId: string, conversationId: string, limit = 20) {
  const db = createServiceClient();
  const { data, error } = await db
    .from("messages")
    .select("role, content")
    .eq("business_id", businessId)
    .eq("conversation_id", conversationId)
    .in("role", ["customer", "ai", "owner"])
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`Could not load history: ${error.message}`);
  return (data ?? [])
    .reverse()
    .map((m) => ({ role: m.role === "customer" ? ("user" as const) : ("assistant" as const), content: m.content }));
}

/** Whether the message before the customer's latest one was typed by staff. */
export async function staffRepliedLast(businessId: string, conversationId: string) {
  const { data } = await createServiceClient()
    .from("messages")
    .select("role")
    .eq("business_id", businessId)
    .eq("conversation_id", conversationId)
    .in("role", ["customer", "ai", "owner"])
    .order("created_at", { ascending: false })
    .limit(2);
  return data?.[1]?.role === "owner";
}

/**
 * The customer a booking is for, found by phone so a returning patient is
 * one row, not one per booking. Also links this chat to them for the inbox.
 */
export async function saveCustomer(businessId: string, conversationId: string, details: { name: string; phone: string }) {
  const db = createServiceClient();
  const { data, error } = await db
    .from("customers")
    .upsert({ business_id: businessId, phone: details.phone, name: details.name }, { onConflict: "business_id,phone" })
    .select("id")
    .single();
  if (error) throw new Error(`Could not save customer: ${error.message}`);
  await db.from("conversations").update({ customer_id: data.id }).eq("id", conversationId).eq("business_id", businessId);
  return data.id;
}
