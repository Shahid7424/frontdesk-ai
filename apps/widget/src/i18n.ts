import type { ChatLanguage } from "@frontdesk/core";

/** Labels on the language switch, each in its own language. */
export const LANGUAGE_OPTIONS: Array<{ value: ChatLanguage; label: string; title: string }> = [
  { value: "auto", label: "Auto", title: "Reply in the language I write in" },
  { value: "en", label: "English", title: "Reply in English" },
  { value: "hinglish", label: "Hinglish", title: "Hindi in English letters" },
  { value: "hi", label: "हिंदी", title: "हिंदी में जवाब" },
];

type UiCopy = {
  greeting: (name: string, configGreeting: string) => string;
  placeholder: string;
  payTitle: string;
  payButton: string;
  payNote: (minutes: number) => string;
  handoff: string;
  connectionError: string;
  detailsTitle: (slot: string) => string;
  namePlaceholder: string;
  phonePlaceholder: string;
  phoneError: string;
  holdButton: string;
  changeSlot: string;
  team: string;
};

const hinglish: UiCopy = {
  greeting: (_, g) => g,
  placeholder: "Apna sawaal likhiye…",
  payTitle: "Booking advance",
  payButton: "Pay securely via UPI",
  payNote: (m) => `Slot ${m} min ke liye hold hai · GPay, PhonePe, Paytm`,
  handoff: "Team ko notify kar diya gaya hai. Aapko yahin ya WhatsApp par reply milega.",
  connectionError: "Connection mein dikkat aayi. Please dobara try kijiye.",
  detailsTitle: (slot) => `${slot} ke liye apna naam aur mobile number dijiye`,
  namePlaceholder: "Patient ka naam",
  phonePlaceholder: "10 digit mobile number",
  phoneError: "Sahi 10 digit mobile number daaliye",
  holdButton: "Slot hold karein",
  changeSlot: "Doosra time",
  team: "Team",
};

/** Widget text per language. Auto keeps the business's own (Hinglish) greeting. */
export const UI: Record<ChatLanguage, UiCopy> = {
  auto: hinglish,
  hinglish,
  en: {
    greeting: (name) => `Hi! 👋 I'm the AI receptionist for ${name}. Ask me about timings, fees or appointments.`,
    placeholder: "Type your question…",
    payTitle: "Booking advance",
    payButton: "Pay securely via UPI",
    payNote: (m) => `Slot held for ${m} min · GPay, PhonePe, Paytm`,
    handoff: "The team has been notified. They'll reply here or on WhatsApp.",
    connectionError: "Connection problem. Please try again.",
    detailsTitle: (slot) => `Your name and mobile number for ${slot}`,
    namePlaceholder: "Patient name",
    phonePlaceholder: "10-digit mobile number",
    phoneError: "Enter a valid 10-digit mobile number",
    holdButton: "Hold this slot",
    changeSlot: "Pick another time",
    team: "Team",
  },
  hi: {
    greeting: (name) => `नमस्ते! 👋 मैं ${name} की AI रिसेप्शनिस्ट हूँ। समय, फ़ीस या अपॉइंटमेंट, कुछ भी पूछिए।`,
    placeholder: "अपना सवाल लिखिए…",
    payTitle: "बुकिंग एडवांस",
    payButton: "UPI से सुरक्षित पेमेंट करें",
    payNote: (m) => `स्लॉट ${m} मिनट के लिए होल्ड है · GPay, PhonePe, Paytm`,
    handoff: "टीम को सूचना दे दी गई है। आपको यहीं या WhatsApp पर जवाब मिलेगा।",
    connectionError: "कनेक्शन में दिक्कत आई। कृपया दोबारा कोशिश करें।",
    detailsTitle: (slot) => `${slot} के लिए अपना नाम और मोबाइल नंबर दीजिए`,
    namePlaceholder: "मरीज़ का नाम",
    phonePlaceholder: "10 अंकों का मोबाइल नंबर",
    phoneError: "सही 10 अंकों का मोबाइल नंबर डालिए",
    holdButton: "स्लॉट होल्ड करें",
    changeSlot: "दूसरा समय",
    team: "टीम",
  },
};
