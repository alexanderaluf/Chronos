import { I18nManager, Text as NativeText, type TextProps } from "react-native";
import { createContext, useContext, type PropsWithChildren } from "react";

import { useAppLocalization } from "@/localization/localization-provider";

const EXPLICIT_ALIGNMENT = /\btext-(left|right|center|justify|start|end)\b/;

const TextAlignmentContext = createContext<"left" | "right" | undefined>(undefined);

/** Apply physical text alignment from the app language, including before a native restart. */
export function TextAlignmentProvider({ children }: PropsWithChildren) {
  const { isRTL } = useAppLocalization();
  return <TextAlignmentContext.Provider value={isRTL ? "right" : "left"}>{children}</TextAlignmentContext.Provider>;
}

export function useTextAlignment() {
  return useContext(TextAlignmentContext);
}

/**
 * Use this instead of React Native's `Text`: it applies the app font, the
 * theme's foreground color and the app language direction (Hebrew = RTL).
 *
 * Text aligns to the start of the reading direction. Native RTL only switches
 * after a restart, so the physical side is chosen from both the app direction
 * and the current native direction (like Plutus). Explicit alignment classes
 * (`text-center`, `text-right`…) are respected.
 */
export function Text({ className, style, ...props }: TextProps & { className?: string }) {
  const { direction, isRTL } = useAppLocalization();
  const preferredAlignment = useTextAlignment();
  const startAlign = isRTL !== I18nManager.isRTL ? "right" : "left";
  const alignment = className && EXPLICIT_ALIGNMENT.test(className) ? undefined : { textAlign: preferredAlignment ?? startAlign } as const;

  return (
    <NativeText
      {...props}
      className={`font-sans text-foreground ${className ?? ""}`}
      style={[alignment, { writingDirection: direction }, preferredAlignment ? { direction: "ltr" } : undefined, style]}
    />
  );
}
