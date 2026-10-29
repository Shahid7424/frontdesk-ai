/** Product name and contact details shown across the site, emails and widget. */
export const BRAND = {
  name: "Swagat AI",
  tagline: "The AI receptionist for Indian businesses",
  contactEmail: process.env.NEXT_PUBLIC_CONTACT_EMAIL?.trim() || "hello@swagat.ai",
} as const;
