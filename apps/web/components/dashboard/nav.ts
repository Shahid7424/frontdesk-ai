import {
  BookOpen,
  CalendarDays,
  Code2,
  Inbox,
  LayoutDashboard,
  Settings,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Shows the "needs you" count on this item. */
  needsYouBadge?: boolean;
}

export const navItems: NavItem[] = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/inbox", label: "Inbox", icon: Inbox, needsYouBadge: true },
  { href: "/dashboard/bookings", label: "Bookings", icon: CalendarDays },
  { href: "/dashboard/knowledge", label: "Knowledge base", icon: BookOpen },
  { href: "/dashboard/widget", label: "Channels", icon: Code2 },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];
