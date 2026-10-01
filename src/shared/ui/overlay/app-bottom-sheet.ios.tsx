import { Host, RNHostView } from "@expo/ui";
import { BottomSheet as NativeBottomSheet, Group } from "@expo/ui/swift-ui";
import { presentationDragIndicator, presentationSizing } from "@expo/ui/swift-ui/modifiers";
import { Keyboard, View, useWindowDimensions } from "react-native";

import { useAppLocalization } from "@/localization/localization-provider";
import { useAppThemeColors } from "@/shared/theme/app-theme";

import type { AppBottomSheetProps } from "./app-bottom-sheet.types";

/**
 * iOS: the native SwiftUI sheet (via @expo/ui). SwiftUI owns the window,
 * backdrop, drag indicator, interactive dismissal and — on iOS 26 — the
 * Liquid Glass background. The React content is embedded with RNHostView and
 * the sheet fits its content.
 */
export function AppBottomSheet({ isOpen, onClose, onDismissed, children }: AppBottomSheetProps) {
  const theme = useAppThemeColors();
  const { isRTL } = useAppLocalization();
  const { width } = useWindowDimensions();

  return (
    <Host
      colorScheme={theme.isDark ? "dark" : "light"}
      layoutDirection={isRTL ? "rightToLeft" : "leftToRight"}
      pointerEvents="none"
      style={{ position: "absolute", width }}
    >
      <NativeBottomSheet
        fitToContents
        isPresented={isOpen}
        onDismiss={onDismissed}
        onIsPresentedChange={(presented) => {
          if (!presented) {
            Keyboard.dismiss();
            onClose();
          }
        }}
      >
        <Group modifiers={[presentationSizing("page"), presentationDragIndicator("visible")]}>
          <RNHostView matchContents>
            <View accessibilityViewIsModal style={{ width, paddingTop: 16 }}>
              {children}
            </View>
          </RNHostView>
        </Group>
      </NativeBottomSheet>
    </Host>
  );
}
