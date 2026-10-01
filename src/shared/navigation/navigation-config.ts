import type { FilledIconName } from "@/shared/ui/filled-icon";

/**
 * The four tabs. To add or rename a tab, change `TabId`, add it here, add
 * the route file in `src/app/(tabs)/` and its label in `tabs.<id>` (locales).
 */
export type TabId = "home" | "calendar" | "stats" | "settings";
export type TabHref = "/" | "/calendar" | "/stats" | "/settings";

export type TabItem = {
  id: TabId;
  href: TabHref;
  icon: FilledIconName;
};

/** What the round button next to the tab bar does on the current tab. */
export type TabAction = {
  icon: FilledIconName;
  label: string;
};

export const navigationItems: TabItem[] = [
  { id: "home", href: "/", icon: "home" },
  { id: "calendar", href: "/calendar", icon: "calendar" },
  { id: "stats", href: "/stats", icon: "chart" },
  { id: "settings", href: "/settings", icon: "settings" },
];

export function getTabFromPathname(pathname: string): TabId {
  if (pathname.startsWith("/calendar")) return "calendar";
  if (pathname.startsWith("/stats")) return "stats";
  if (pathname.startsWith("/settings")) return "settings";
  return "home";
}
