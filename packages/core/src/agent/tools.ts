import type Anthropic from "@anthropic-ai/sdk";
import type { BusinessKnowledge } from "./types";

/**
 * Tools the model can call. The model never writes to the database except
 * through cancel_booking, which only reaches the customer's own booking.
 * business_id is never a tool argument; the server already knows which
 * business it is serving, so a prompt injection can't point the agent at
 * another tenant.
 *
 * strict: true + an enum of this business's service ids means the model
 * can't invent a service.
 */
export function buildTools(b: BusinessKnowledge): Anthropic.Tool[] {
  return [
    {
      name: "check_availability",
      description:
        "Find free appointment slots for one service on a given date. The slots are shown to the customer as tappable buttons. Use when the customer wants to book or asks when they can come.",
      strict: true,
      input_schema: {
        type: "object",
        properties: {
          service_id: {
            type: "string",
            enum: b.services.map((s) => s.id),
            description: "The id of the service from business_information.",
          },
          date: {
            type: "string",
            description:
              "Day to check: 'today', 'tomorrow', 'day_after_tomorrow', a weekday name like 'saturday', or YYYY-MM-DD for any other date (India time). Use 'today' if the customer didn't say. Kal = tomorrow, parso = day_after_tomorrow.",
          },
        },
        required: ["service_id", "date"],
        additionalProperties: false,
      },
    },
    {
      name: "show_booking",
      description:
        "Look up the slot the customer booked in this chat. If it awaits payment, the customer is shown the payment card again (the hold is renewed if it lapsed). Use when they ask for the payment link, how to pay, or their booking status.",
      strict: true,
      input_schema: { type: "object", properties: {}, required: [], additionalProperties: false },
    },
    {
      name: "cancel_booking",
      description:
        "Cancel the customer's booking (the one show_booking reports). First tell them which booking it is and ask them to confirm; call this only after they clearly say yes, with customer_confirmed true.",
      strict: true,
      input_schema: {
        type: "object",
        properties: {
          customer_confirmed: { type: "boolean", description: "True only if the customer confirmed this cancellation in their latest message." },
        },
        required: ["customer_confirmed"],
        additionalProperties: false,
      },
    },
    {
      name: "reschedule_booking",
      description:
        "Offer new times for the customer's existing booking, same service. The free slots are shown as buttons; the booking moves when the customer taps one, keeping any advance already paid. Use when they want to change the day or time of their appointment.",
      strict: true,
      input_schema: {
        type: "object",
        properties: {
          date: {
            type: "string",
            description: "Day to look at, same format as check_availability's date. Use 'today' if the customer didn't say.",
          },
        },
        required: ["date"],
        additionalProperties: false,
      },
    },
    {
      name: "handoff_to_human",
      description:
        "Hand the conversation to the business's staff. Use when the customer asks for a person, complains, or needs something you can't answer from business_information.",
      strict: true,
      input_schema: {
        type: "object",
        properties: {
          reason: {
            type: "string",
            enum: ["customer_requested", "complaint", "unknown_answer", "medical", "other"],
          },
          summary: { type: "string", description: "One sentence for the staff: what the customer needs." },
        },
        required: ["reason", "summary"],
        additionalProperties: false,
      },
    },
  ];
}
