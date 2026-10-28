import { addDays } from "./availability";

const WEEKDAYS: Array<[number, RegExp]> = [
  [0, /\b(sunday|sun|ravivar|itwar|itvaar)\b|रविवार|इतवार/],
  [1, /\b(monday|mon|somvar|somwar)\b|सोमवार/],
  [2, /\b(tuesday|tue|tues|mangalvar|mangalwar)\b|मंगलवार/],
  [3, /\b(wednesday|wed|budhvar|budhwar)\b|बुधवार/],
  [4, /\b(thursday|thu|thurs|guruvar|guruwar|veervar)\b|गुरुवार|वीरवार/],
  [5, /\b(friday|fri|shukravar|shukrawar)\b|शुक्रवार/],
  [6, /\b(saturday|sat|shanivar|shaniwar)\b|शनिवार/],
];

const RELATIVE: Array<[number, RegExp]> = [
  [0, /\b(aaj|aj|today|tonight)\b|आज/],
  // "kal" is also "yesterday" in Hindi, but nobody books yesterday.
  [1, /\b(kal|kl|tomorrow|tmrw|tmr|tomorow)\b|कल/],
  [2, /\b(parso|parson|parsoon|day after tomorrow)\b|परसों/],
];

const weekdayOf = (day: string) => new Date(`${day}T12:00:00+05:30`).getUTCDay();

/** Next date (today included) that falls on this weekday. */
function nextWeekday(today: string, weekday: number): string {
  return addDays(today, (weekday - weekdayOf(today) + 7) % 7);
}

/**
 * Turns the model's date argument into YYYY-MM-DD. Accepts an ISO date or
 * a word (today, tomorrow, day_after_tomorrow, a weekday), so the model
 * never has to do calendar arithmetic, which small open models get wrong.
 */
export function resolveDay(value: string, today: string): string | null {
  const v = value.trim().toLowerCase().replace(/_/g, " ");
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  if (v === "day after tomorrow") return addDays(today, 2);
  for (const [offset, re] of RELATIVE) if (re.test(v)) return addDays(today, offset);
  for (const [weekday, re] of WEEKDAYS) if (re.test(v)) return nextWeekday(today, weekday);
  return null;
}

/**
 * The day a customer message clearly points at ("kal", "parso", "Saturday"),
 * or null when it names none or more than one ("kal nahi, parso").
 */
export function dayInText(text: string, today: string): string | null {
  const t = text.toLowerCase();
  const found = new Set<string>();
  // Match the longer phrase first so "day after tomorrow" isn't read as "tomorrow".
  const rest = t.replace(/day after tomorrow/g, () => (found.add(addDays(today, 2)), " "));
  for (const [offset, re] of RELATIVE) if (re.test(rest)) found.add(addDays(today, offset));
  for (const [weekday, re] of WEEKDAYS) if (re.test(rest)) found.add(nextWeekday(today, weekday));
  return found.size === 1 ? [...found][0]! : null;
}

/** "Tue, 27 Oct" for tool results and the prompt's date table. */
export function dayLabel(day: string): string {
  return new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "Asia/Kolkata" }).format(
    new Date(`${day}T12:00:00+05:30`),
  );
}
