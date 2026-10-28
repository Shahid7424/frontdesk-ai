import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "FrontDesk AI · AI receptionist for clinics, salons & coaching",
    template: "%s · FrontDesk AI",
  },
  description:
    "FrontDesk AI answers customer questions in Hinglish on WhatsApp and your website, books appointments and sends UPI payment links, 24×7.",
};

export const viewport: Viewport = {
  themeColor: "#0f655e",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={jakarta.variable}>
      <body className="min-h-dvh font-sans">{children}</body>
    </html>
  );
}
