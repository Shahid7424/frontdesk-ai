import type { Metadata } from "next";
import { PageHeader } from "@/components/dashboard/page-header";
import { Card, CardHeader } from "@/components/ui/card";
import { PaymentModeCard } from "@/components/dashboard/payment-mode";
import { AlertsCard } from "@/components/dashboard/alerts-card";
import { SetupForm } from "@/components/dashboard/setup-form";
import { getAlertSettings, getBusinessContext, getBusinessSetup, getPaymentMode } from "@/lib/data/business";
import { isRazorpayConfigured, isRazorpayTestMode } from "@/lib/payments/razorpay";
import { settingsFromSetup, WEEKDAYS } from "@/lib/onboarding";

export const metadata: Metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

const RULES = [
  "Answers only from your details and documents, and says so when it doesn't know.",
  "Replies in the customer's language: English, Hinglish or Hindi.",
  "Hands the chat to you when the customer asks for a person or is unhappy.",
  "For clinics: never diagnoses or suggests medicines, and points emergencies to 108.",
];

export default async function SettingsPage() {
  const ctx = await getBusinessContext();
  const business = ctx.business!;
  const [{ services, staff, hours }, paymentMode, alerts] = await Promise.all([getBusinessSetup(ctx), getPaymentMode(ctx), getAlertSettings(ctx)]);

  const initial = settingsFromSetup(business, { services, staff, hours });
  const staffIds = new Set(staff.map((s) => s.id));
  // Hours set for one person aren't editable here yet; show them so nothing is hidden.
  const staffOnlyHours = hours
    .filter((h) => h.staffId && staffIds.has(h.staffId))
    .map((h) => `${WEEKDAYS[h.weekday]} ${h.start}–${h.end} (${staff.find((p) => p.id === h.staffId)?.name} only)`);

  return (
    <div className="container-page space-y-6 py-8">
      <PageHeader title="Settings" description="Business details the AI uses to answer and book." />

      <SetupForm initial={initial} staffOnlyHours={staffOnlyHours} />

      <AlertsCard initial={alerts} loginEmail={ctx.user?.email || null} delivery={Boolean(process.env.RESEND_API_KEY)} />

      <PaymentModeCard initial={paymentMode} razorpay={isRazorpayConfigured ? (isRazorpayTestMode ? "test" : "live") : "off"} />

      <Card>
        <CardHeader title="Built-in rules" description="Always on, so your receptionist stays safe to put on your website." />
        <ul className="list-disc space-y-1.5 px-5 pb-5 pl-10 text-sm text-slate-600">
          {RULES.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
