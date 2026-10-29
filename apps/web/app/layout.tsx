import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";

// Self-hosted, so builds never depend on reaching Google Fonts.
const jakarta = localFont({
  src: [
    { path: "./fonts/jakarta-latin.woff2", weight: "200 800", style: "normal" },
    { path: "./fonts/jakarta-latin-ext.woff2", weight: "200 800", style: "normal" },
  ],
  variable: "--font-jakarta",
  display: "swap",
});

// Display serif, used for a word or two of emphasis in headlines.
const serif = localFont({
  src: [
    { path: "./fonts/instrument-serif.woff2", weight: "400", style: "normal" },
    { path: "./fonts/instrument-serif-italic.woff2", weight: "400", style: "italic" },
  ],
  variable: "--font-instrument",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Swagat AI · The AI receptionist for Indian businesses",
    template: "%s · Swagat AI",
  },
  description:
    "Swagat AI welcomes every customer on your website. It answers in Hinglish, books appointments and sends UPI payment links, 24×7.",
  applicationName: "Swagat AI",
  openGraph: {
    title: "Swagat AI · The AI receptionist for Indian businesses",
    description: "Answers in Hinglish, books appointments and collects UPI advances, 24×7.",
    siteName: "Swagat AI",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#4c1fb8",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${jakarta.variable} ${serif.variable}`}>
      <body className="min-h-dvh font-sans">{children}</body>
    </html>
  );
}
