/**
 * Demo tenant used by the landing demo, the widget and the dashboard
 * until Supabase is wired up (Day 2). Same shape the `businesses`,
 * `services`, `staff` and `chunks` tables will have, so swapping the
 * source later does not touch the UI.
 */

export const DEMO_BUSINESS_ID = "sunrise-clinic";

export const demoClinic = {
  id: DEMO_BUSINESS_ID,
  name: "Sunrise Family Clinic",
  vertical: "clinic" as const,
  area: "Baner, Pune",
  address: "2nd floor, Sai Plaza, Baner Road, near Balewadi Phata, Pune 411045",
  phone: "+91 98XXX XXX21",
  accentColor: "#5a2bd4",
  hours: [
    { days: "Mon to Sat", time: "9:00 AM – 1:30 PM, 5:00 PM – 9:00 PM" },
    { days: "Sunday", time: "10:00 AM – 1:00 PM (only Dr. Mehta)" },
  ],
};

export interface Service {
  id: string;
  name: string;
  durationMin: number;
  pricePaise: number;
  staffIds: string[];
}

export const staff = [
  { id: "dr-mehta", name: "Dr. Anjali Mehta", role: "General Physician" },
  { id: "dr-kulkarni", name: "Dr. Rohan Kulkarni", role: "Pulmonologist" },
  { id: "nisha", name: "Nisha Patil", role: "Physiotherapist" },
];

export const services: Service[] = [
  { id: "gp-consult", name: "General consultation", durationMin: 15, pricePaise: 50000, staffIds: ["dr-mehta"] },
  { id: "chest-consult", name: "Chest & asthma consultation", durationMin: 20, pricePaise: 80000, staffIds: ["dr-kulkarni"] },
  { id: "pft", name: "Lung function test (PFT)", durationMin: 30, pricePaise: 120000, staffIds: ["dr-kulkarni"] },
  { id: "physio", name: "Physiotherapy session", durationMin: 45, pricePaise: 70000, staffIds: ["nisha"] },
  { id: "follow-up", name: "Follow-up (within 7 days)", durationMin: 10, pricePaise: 0, staffIds: ["dr-mehta", "dr-kulkarni"] },
];

/** Knowledge base chunks. In production these come from hybrid search. */
export const knowledge = [
  {
    id: "kb-fees",
    title: "Fees & services",
    source: "Clinic rate card.pdf",
    text: "General consultation ₹500, chest & asthma consultation ₹800, lung function test ₹1,200, physiotherapy ₹700 per session. Follow-up within 7 days is free.",
  },
  {
    id: "kb-hours",
    title: "Clinic timings",
    source: "FAQ",
    text: "Mon to Sat 9:00 AM – 1:30 PM and 5:00 PM – 9:00 PM. Sunday 10:00 AM – 1:00 PM, only Dr. Mehta.",
  },
  {
    id: "kb-location",
    title: "Address & parking",
    source: "FAQ",
    text: "2nd floor, Sai Plaza, Baner Road, near Balewadi Phata. Lift available. Two-wheeler parking in front, car parking in the basement.",
  },
  {
    id: "kb-reports",
    title: "Reports & test results",
    source: "FAQ",
    text: "PFT reports are ready in 30 minutes. Blood test reports from the partner lab come on WhatsApp within 24 hours.",
  },
  {
    id: "kb-insurance",
    title: "Payments & insurance",
    source: "FAQ",
    text: "UPI, cards and cash accepted. Cashless insurance is not available for OPD; we give a bill for reimbursement.",
  },
  {
    id: "kb-prep",
    title: "PFT preparation",
    source: "Patient guide.pdf",
    text: "Avoid inhalers 4 hours before a lung function test if your doctor allows, no heavy meal 2 hours before, wear loose clothes.",
  },
];

export const demoQuickReplies = [
  "Consultation fees kitni hai?",
  "Kal ka appointment chahiye",
  "Sunday ko clinic khula hai?",
  "PFT ke liye kya tayari karni hai?",
];
