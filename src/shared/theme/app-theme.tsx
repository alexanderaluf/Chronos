import { useThemeColor } from "heroui-native";
import { useEffect } from "react";
import { Appearance, processColor } from "react-native";
import { Uniwind, useUniwind } from "uniwind";

import { useSettings } from "@/data/hooks/queries";
import type { AccentColorId } from "@/domain/entities";

/**
 * The Chronos theme is the Plutus theme: semantic color tokens live in
 * `global.css` (light + dark), and the user picks one accent color.
 * In components, prefer Tailwind classes (`bg-surface`, `text-muted`);
 * use `useAppThemeColors()` only where a raw color value is required.
 */

type AccentOption = {
  id: AccentColorId;
  label: string;
  swatch: string;
  light: { accent: string; foreground: string };
  dark: { accent: string; foreground: string };
};

/** Text and icons on the accent are black for every accent. */
export const ACCENT_OPTIONS: AccentOption[] = [
  { id: "cyan", label: "Cyan", swatch: "#45BCD4", light: { accent: "#087E8B", foreground: "#000000" }, dark: { accent: "#70D2EB", foreground: "#000000" } },
  { id: "blue", label: "Blue", swatch: "#4D8FF7", light: { accent: "#2563EB", foreground: "#000000" }, dark: { accent: "#7DB3FF", foreground: "#000000" } },
  { id: "violet", label: "Violet", swatch: "#9A77E8", light: { accent: "#7138C7", foreground: "#000000" }, dark: { accent: "#B89CF5", foreground: "#000000" } },
  { id: "rose", label: "Rose", swatch: "#E36A98", light: { accent: "#B83768", foreground: "#000000" }, dark: { accent: "#F187AE", foreground: "#000000" } },
  { id: "coral", label: "Coral", swatch: "#EA685B", light: { accent: "#BB4034", foreground: "#000000" }, dark: { accent: "#FF958A", foreground: "#000000" } },
  { id: "amber", label: "Amber", swatch: "#D99A2B", light: { accent: "#966000", foreground: "#000000" }, dark: { accent: "#F2C66D", foreground: "#000000" } },
  { id: "green", label: "Green", swatch: "#42B77B", light: { accent: "#177849", foreground: "#000000" }, dark: { accent: "#7ADDAA", foreground: "#000000" } },
  { id: "lime", label: "Lime", swatch: "#86AD3A", light: { accent: "#557817", foreground: "#000000" }, dark: { accent: "#B9DB72", foreground: "#000000" } },
];

/** Root background per scheme — matches `--background` in global.css and app.json. */
export const ROOT_BACKGROUNDS = { dark: "#000000", light: "#DCE7E0" } as const;

export function colorWithAlpha(color: string, alpha: number) {
  const processed = processColor(color.trim());
  if (typeof processed !== "number") return color;
  return `rgba(${(processed >>> 16) & 255}, ${(processed >>> 8) & 255}, ${processed & 255}, ${Math.min(Math.max(alpha, 0), 1)})`;
}

/** Dark or light text, whichever reads better on `color` (e.g. initials on a job color). */
export function readableTextOn(color: string) {
  const processed = processColor(color.trim());
  if (typeof processed !== "number") return "#090909";
  const channel = (shift: number) => {
    const value = ((processed >>> shift) & 255) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  const luminance = 0.2126 * channel(16) + 0.7152 * channel(8) + 0.0722 * channel(0);
  return luminance > 0.36 ? "#090909" : "#FFFFFF";
}

export function useAppThemeColors() {
  const [
    background,
    foreground,
    surface,
    surfaceSecondary,
    surfaceTertiary,
    border,
    muted,
    accent,
    accentForeground,
    danger,
    success,
    warning,
  ] = useThemeColor([
    "background",
    "foreground",
    "surface",
    "surface-secondary",
    "surface-tertiary",
    "border",
    "muted",
    "accent",
    "accent-foreground",
    "danger",
    "success",
    "warning",
  ]);
  const { theme } = useUniwind();

  return {
    accent,
    accentForeground,
    background,
    border,
    danger,
    foreground,
    isDark: theme === "dark",
    muted,
    success,
    surface,
    surfaceSecondary,
    surfaceTertiary,
    warning,
  };
}

/** Applies the saved theme mode and accent color. Render once near the root. */
export function AppThemeController() {
  const settings = useSettings();
  const themeMode = settings.data?.themeMode ?? "system";
  const accentColor = settings.data?.accentColor ?? "cyan";

  useEffect(() => {
    const accent = ACCENT_OPTIONS.find((option) => option.id === accentColor) ?? ACCENT_OPTIONS[0];
    Uniwind.updateCSSVariables("light", {
      "--accent": accent.light.accent,
      "--accent-foreground": accent.light.foreground,
      "--focus": accent.light.accent,
      "--link": accent.light.accent,
    });
    Uniwind.updateCSSVariables("dark", {
      "--accent": accent.dark.accent,
      "--accent-foreground": accent.dark.foreground,
      "--focus": accent.dark.accent,
      "--link": accent.dark.accent,
    });
    Appearance.setColorScheme(themeMode === "system" ? "unspecified" : themeMode);
    Uniwind.setTheme(themeMode);
  }, [accentColor, themeMode]);

  return null;
}
