"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { saveBusinessSetup } from "@/app/(dashboard)/dashboard/settings/actions";
import { BusinessFields, HoursFields, ServicesFields, StaffFields, type Errors } from "@/components/setup/setup-fields";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import type { SettingsInput } from "@/lib/onboarding";

/**
 * Business profile, team, services and opening hours, edited together and
 * saved in one go. A bar with Save appears once anything changes.
 */
export function SetupForm({ initial, staffOnlyHours }: { initial: SettingsInput; staffOnlyHours: string[] }) {
  const router = useRouter();
  const [saved, setSaved] = useState(initial);
  const [business, setBusiness] = useState(initial.business);
  const [staff, setStaff] = useState(initial.staff);
  const [services, setServices] = useState(initial.services);
  const [hours, setHours] = useState(initial.hours);
  const [errors, setErrors] = useState<Errors>({});
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const current = useMemo(() => ({ business, staff, services, hours }), [business, staff, services, hours]);
  const dirty = JSON.stringify(current) !== JSON.stringify(saved);

  // Don't lose edits to an accidental tab close.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const save = () => {
    setMessage(null);
    startTransition(async () => {
      const r = await saveBusinessSetup(current);
      if (r.ok) {
        setErrors({});
        setSaved(current);
        setMessage({ ok: true, text: "Saved. The AI uses this from the next message." });
        // New staff and services get database ids; reload them so the next save updates in place.
        router.refresh();
      } else {
        setErrors("fieldErrors" in r ? r.fieldErrors : {});
        setMessage({ ok: false, text: r.error });
      }
    });
  };

  const reset = () => {
    setBusiness(saved.business);
    setStaff(saved.staff);
    setServices(saved.services);
    setHours(saved.hours);
    setErrors({});
    setMessage(null);
  };

  // After a refresh the server sends rows with ids; take them once nothing is being edited.
  useEffect(() => {
    if (pending || JSON.stringify(initial) === JSON.stringify(saved)) return;
    if (!dirty) {
      setSaved(initial);
      setBusiness(initial.business);
      setStaff(initial.staff);
      setServices(initial.services);
      setHours(initial.hours);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title="Business profile" description="Shared when customers ask for your address or number." />
        <div className="p-5">
          <BusinessFields value={business} onChange={setBusiness} errors={errors} />
        </div>
      </Card>

      <Card>
        <CardHeader title="Team" description="Who customers can book. Removing someone keeps their existing bookings." />
        <div className="p-5">
          <StaffFields value={staff} onChange={setStaff} errors={errors} vertical={business.vertical} />
        </div>
      </Card>

      <Card>
        <CardHeader title="Services & prices" description="The AI quotes these prices and takes the advance for paid services." />
        <div className="p-5">
          <ServicesFields value={services} onChange={setServices} staff={staff} errors={errors} vertical={business.vertical} />
        </div>
      </Card>

      <Card>
        <CardHeader title="Opening hours" description="New bookings follow these hours. Appointments already booked stay as they are." />
        <div className="p-5">
          <HoursFields value={hours} onChange={setHours} errors={errors} />
          {staffOnlyHours.length > 0 && (
            <p className="mt-3 text-xs text-slate-500">
              Also kept as set up: {staffOnlyHours.join("; ")}.
            </p>
          )}
        </div>
      </Card>

      {(dirty || message) && (
        <div className="sticky bottom-4 z-10 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white px-4 py-3 shadow-lg ring-1 ring-black/10">
          <p role="status" className={message ? (message.ok ? "text-sm font-medium text-emerald-700" : "text-sm font-medium text-red-600") : "text-sm text-slate-600"}>
            {message?.text ?? "You have unsaved changes."}
          </p>
          {dirty && (
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={reset} disabled={pending}>
                Discard
              </Button>
              <Button size="sm" onClick={save} disabled={pending}>
                {pending && <Loader2 className="size-4 animate-spin" />}
                {pending ? "Saving…" : "Save changes"}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
