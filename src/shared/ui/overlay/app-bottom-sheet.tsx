import { useEffect, useEffectEvent, useState } from "react";
import { useTranslation } from "react-i18next";
import { BackHandler, Keyboard, Pressable, StyleSheet, View, useWindowDimensions } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { scheduleOnRN } from "react-native-worklets";

import { useAppThemeColors } from "@/shared/theme/app-theme";

import type { AppBottomSheetProps } from "./app-bottom-sheet.types";
import { Portal } from "./portal";

const OPEN = { duration: 280, easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.System };
const CLOSE = { duration: 220, easing: Easing.in(Easing.cubic), reduceMotion: ReduceMotion.System };
const SETTLE = { damping: 22, stiffness: 260, reduceMotion: ReduceMotion.System };

/**
 * Android: a sheet built from scratch — no native sheet, no RN `Modal`.
 * Rendered through the app Portal. Closes by dragging down, tapping the
 * backdrop, or the system back button/gesture.
 */
export function AppBottomSheet({ isOpen, onClose, onDismissed, children }: AppBottomSheetProps) {
  const [mounted, setMounted] = useState(isOpen);
  if (isOpen && !mounted) setMounted(true);

  if (!mounted) return null;
  return (
    <Portal>
      <SheetLayer
        isOpen={isOpen}
        onClose={onClose}
        onHidden={() => {
          setMounted(false);
          onDismissed?.();
        }}
      >
        {children}
      </SheetLayer>
    </Portal>
  );
}

function SheetLayer({
  isOpen,
  onClose,
  onHidden,
  children,
}: Pick<AppBottomSheetProps, "isOpen" | "onClose" | "children"> & { onHidden: () => void }) {
  const { t } = useTranslation();
  const theme = useAppThemeColors();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const [sheetHeight, setSheetHeight] = useState(0);
  const progress = useSharedValue(0);
  const dragY = useSharedValue(0);
  const hidden = useEffectEvent(() => onHidden());
  const requestClose = useEffectEvent(() => onClose());

  // Slide in once measured; slide out when closed, then unmount.
  useEffect(() => {
    if (sheetHeight === 0) return;
    if (isOpen) {
      dragY.set(0);
      progress.set(withTiming(1, OPEN));
    } else {
      Keyboard.dismiss();
      progress.set(
        withTiming(0, CLOSE, (finished) => {
          if (finished) scheduleOnRN(hidden);
        }),
      );
    }
  }, [isOpen, sheetHeight, progress, dragY]);

  // System back closes the sheet instead of leaving the screen.
  useEffect(() => {
    if (!isOpen) return;
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      requestClose();
      return true;
    });
    return () => subscription.remove();
  }, [isOpen]);

  const pan = Gesture.Pan()
    .activeOffsetY(8)
    .onUpdate((event) => {
      dragY.set(Math.max(0, event.translationY));
    })
    .onEnd((event) => {
      if (event.translationY > sheetHeight * 0.25 || event.velocityY > 900) {
        scheduleOnRN(onClose);
      } else {
        dragY.set(withSpring(0, SETTLE));
      }
    });

  const backdropStyle = useAnimatedStyle(() => ({ opacity: progress.get() * 0.45 }));
  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: (1 - progress.get()) * (sheetHeight || windowHeight) + dragY.get() }],
  }));

  return (
    <View style={StyleSheet.absoluteFill}>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: "#000" }, backdropStyle]}>
        <Pressable accessibilityLabel={t("common.close")} accessibilityRole="button" style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>

      <Animated.View
        accessibilityViewIsModal
        style={[
          styles.sheet,
          {
            backgroundColor: theme.surface,
            maxHeight: windowHeight * 0.92,
            paddingBottom: Math.max(insets.bottom, 16),
            // Hidden until measured so it never flashes at the final position.
            opacity: sheetHeight === 0 ? 0 : 1,
          },
          sheetStyle,
        ]}
        onLayout={(event) => setSheetHeight(event.nativeEvent.layout.height)}
      >
        <GestureDetector gesture={pan}>
          <View style={styles.handleArea}>
            <View style={[styles.handle, { backgroundColor: theme.muted }]} />
          </View>
        </GestureDetector>
        {children}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: "hidden",
  },
  handleArea: {
    alignItems: "center",
    paddingBottom: 6,
    paddingTop: 10,
  },
  handle: {
    borderRadius: 3,
    height: 5,
    opacity: 0.5,
    width: 40,
  },
});
