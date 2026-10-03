import { DatePicker, Host, Popover, Spacer, VStack } from "@expo/ui/swift-ui";
import { datePickerStyle, environment, frame, padding, scaleEffect, tint } from "@expo/ui/swift-ui/modifiers";
import { useEffect, useRef, useState } from "react";
import { View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAppLocalization } from "@/localization/localization-provider";
import type { AppLanguage } from "@/localization/languages";
import { useAppThemeColors } from "@/shared/theme/app-theme";

import type { DateTimePickerOverlayProps } from "./date-time-picker-overlay.types";

// Same sizing as Plutus: the graphical calendar is scaled to fit a 300pt popover.
const PICKER_LAYOUT = {
  date: {
    frame: { width: 300, height: 310 },
    contentFrame: { width: 340, height: 350 },
    contentScale: 300 / 340,
  },
  time: {
    frame: { width: 300, height: 220 },
    contentFrame: { width: 300, height: 220 },
    contentScale: 1,
  },
} as const;
const POPOVER_PADDING = 12;
// Locales whose clock is 24-hour, so the time wheel never shows AM / PM.
const TIME_LOCALES: Record<AppLanguage, string> = { en: "en_GB", he: "he_IL", ru: "ru_RU" };
const POPOVER_ARROW_HEIGHT = 16;

/** iOS: a native SwiftUI popover (graphical calendar / time wheel), anchored to the parent. */
export function DateTimePickerOverlay({
  isPresented,
  mode,
  value,
  title,
  minimumDate,
  maximumDate,
  onChange,
  onDismiss,
}: DateTimePickerOverlayProps) {
  const theme = useAppThemeColors();
  const { language } = useAppLocalization();
  const anchorRef = useRef<View>(null);
  const { height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const layout = PICKER_LAYOUT[mode];
  const [isPlacementReady, setIsPlacementReady] = useState(false);
  const [opensBelow, setOpensBelow] = useState(true);

  // Open below the anchor when there is room, otherwise above it.
  useEffect(() => {
    let cancelled = false;
    const frameId = requestAnimationFrame(() => {
      if (!isPresented) {
        setIsPlacementReady(false);
        return;
      }
      anchorRef.current?.measureInWindow((_x, y, _width, height) => {
        if (cancelled) return;
        const popoverHeight = layout.frame.height + POPOVER_PADDING * 2 + POPOVER_ARROW_HEIGHT;
        const bottomEdge = windowHeight - Math.max(insets.bottom, POPOVER_PADDING);
        setOpensBelow(bottomEdge - (y + height) >= popoverHeight);
        setIsPlacementReady(true);
      });
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(frameId);
    };
  }, [insets.bottom, isPresented, layout.frame.height, windowHeight]);

  const range =
    minimumDate || maximumDate ? { start: minimumDate, end: maximumDate } : undefined;

  return (
    <View ref={anchorRef} collapsable={false} pointerEvents="box-none" style={{ position: "absolute", inset: 0 }}>
      <Host
        colorScheme={theme.isDark ? "dark" : "light"}
        seedColor={theme.accent}
        style={{
          position: "absolute",
          ...(opensBelow ? { bottom: 0 } : { top: 0 }),
          left: "50%",
          width: 1,
          height: 1,
        }}
      >
        <Popover
          arrowEdge={opensBelow ? "top" : "bottom"}
          attachmentAnchor={opensBelow ? "bottom" : "top"}
          isPresented={isPresented && isPlacementReady}
          onIsPresentedChange={(presented) => {
            if (!presented) {
              setIsPlacementReady(false);
              if (isPresented) onDismiss();
            }
          }}
        >
          <Popover.Trigger>
            <Spacer modifiers={[frame({ width: 1, height: 1 })]} />
          </Popover.Trigger>
          <Popover.Content>
            <VStack modifiers={[frame(layout.frame), padding({ all: POPOVER_PADDING })]} spacing={12}>
              <DatePicker
                displayedComponents={[mode === "time" ? "hourAndMinute" : "date"]}
                modifiers={[
                  ...(mode === "time" ? [environment("locale", TIME_LOCALES[language])] : []),
                  datePickerStyle(mode === "time" ? "wheel" : "graphical"),
                  tint(theme.accent),
                  frame(layout.contentFrame),
                  scaleEffect(layout.contentScale),
                  frame(layout.frame),
                ]}
                range={range}
                selection={value}
                title={title}
                onDateChange={onChange}
              />
            </VStack>
          </Popover.Content>
        </Popover>
      </Host>
    </View>
  );
}
