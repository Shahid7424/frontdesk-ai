import { MessageCircle, Globe } from "lucide-react";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import type { BookingStatus, Channel, ConversationStatus } from "@/lib/mock/dashboard";

const conversationStatus: Record<ConversationStatus, { label: string; tone: BadgeTone }> = {
  ai: { label: "AI handling", tone: "brand" },
  needs_human: { label: "Needs you", tone: "amber" },
  human: { label: "You're replying", tone: "blue" },
  resolved: { label: "Resolved", tone: "neutral" },
};

export function ConversationStatusBadge({ status }: { status: ConversationStatus }) {
  const s = conversationStatus[status];
  return (
    <Badge tone={s.tone} dot>
      {s.label}
    </Badge>
  );
}

const bookingStatus: Record<BookingStatus, { label: string; tone: BadgeTone }> = {
  confirmed: { label: "Confirmed", tone: "green" },
  pending_payment: { label: "Awaiting payment", tone: "amber" },
  completed: { label: "Completed", tone: "neutral" },
  cancelled: { label: "Cancelled", tone: "red" },
  no_show: { label: "No-show", tone: "red" },
  expired: { label: "Hold expired", tone: "neutral" },
};

export function BookingStatusBadge({ status }: { status: BookingStatus }) {
  const s = bookingStatus[status];
  return <Badge tone={s.tone}>{s.label}</Badge>;
}

export function ChannelIcon({ channel, className }: { channel: Channel; className?: string }) {
  return channel === "whatsapp" ? (
    <MessageCircle className={className ?? "size-3.5 text-emerald-600"} aria-label="WhatsApp" />
  ) : (
    <Globe className={className ?? "size-3.5 text-sky-600"} aria-label="Website" />
  );
}
