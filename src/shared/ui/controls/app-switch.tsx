import { useEffect } from "react";
import { Keyboard, Pressable, StyleSheet } from "react-native";
import Animated, {
  interpolateColor,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { useAppLocalization } from "@/localization/localization-provider";
import { useAppThemeColors } from "@/shared/theme/app-theme";

import type { AppSwitchProps } from "./app-switch.types";
import { SWITCH_INSET, SWITCH_THUMB_SIZE, SWITCH_TRACK_HEIGHT, SWITCH_TRACK_WIDTH, switchThumbOffset } from "./app-switch-layout";

/** Android: a toggle built from scratch (no native Switch / Compose). */
export function AppSwitch({ value, onValueChange, disabled, accessibilityLabel }: AppSwitchProps) {
  const theme = useAppThemeColors();
  const { isRTL } = useAppLocalization();
  const progress = useSharedValue(value ? 1 : 0);

  useEffect(() => {
    progress.set(withTiming(value ? 1 : 0, { duration: 180, reduceMotion: ReduceMotion.System }));
  }, [value, progress]);

  const trackStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.get(), [0, 1], [theme.surfaceTertiary, theme.accent]),
  }));
  const thumbStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.get(), [0, 1], [theme.muted, theme.accentForeground]),
    transform: [{ translateX: switchThumbOffset(progress.get(), isRTL) }],
  }));

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      disabled={disabled}
      hitSlop={8}
      style={{ opacity: disabled ? 0.5 : 1 }}
      onPress={() => {
        Keyboard.dismiss();
        onValueChange(!value);
      }}
    >
      <Animated.View style={[styles.track, trackStyle]}>
        <Animated.View style={[styles.thumb, thumbStyle]} />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: {
    // The thumb always starts at the physical left inset. Only its travel is mirrored.
    direction: "ltr",
    borderRadius: SWITCH_TRACK_HEIGHT / 2,
    height: SWITCH_TRACK_HEIGHT,
    overflow: "hidden",
    width: SWITCH_TRACK_WIDTH,
  },
  thumb: {
    position: "absolute",
    start: SWITCH_INSET,
    top: SWITCH_INSET,
    borderRadius: SWITCH_THUMB_SIZE / 2,
    height: SWITCH_THUMB_SIZE,
    width: SWITCH_THUMB_SIZE,
  },
});
