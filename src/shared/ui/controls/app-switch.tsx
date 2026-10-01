import { useEffect } from "react";
import { Pressable, StyleSheet } from "react-native";
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

const TRACK_WIDTH = 52;
const TRACK_HEIGHT = 32;
const THUMB = 24;
const TRAVEL = TRACK_WIDTH - THUMB - 8;

/** Android: a toggle built from scratch (no native Switch / Compose). */
export function AppSwitch({ value, onValueChange, disabled, accessibilityLabel }: AppSwitchProps) {
  const theme = useAppThemeColors();
  // Transforms are not mirrored by the layout direction, so flip the travel in Hebrew.
  const direction = useAppLocalization().isRTL ? -1 : 1;
  const progress = useSharedValue(value ? 1 : 0);

  useEffect(() => {
    progress.set(withTiming(value ? 1 : 0, { duration: 180, reduceMotion: ReduceMotion.System }));
  }, [value, progress]);

  const trackStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.get(), [0, 1], [theme.surfaceTertiary, theme.accent]),
  }));
  const thumbStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.get(), [0, 1], [theme.muted, theme.accentForeground]),
    transform: [{ translateX: direction * progress.get() * TRAVEL }],
  }));

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      disabled={disabled}
      hitSlop={8}
      style={{ opacity: disabled ? 0.5 : 1 }}
      onPress={() => onValueChange(!value)}
    >
      <Animated.View style={[styles.track, trackStyle]}>
        <Animated.View style={[styles.thumb, thumbStyle]} />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: {
    borderRadius: TRACK_HEIGHT / 2,
    height: TRACK_HEIGHT,
    justifyContent: "center",
    paddingHorizontal: 4,
    width: TRACK_WIDTH,
  },
  thumb: {
    borderRadius: THUMB / 2,
    height: THUMB,
    width: THUMB,
  },
});
