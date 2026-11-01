import { useEffect, type ReactNode } from "react";
import { View } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  FadeIn,
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";

import { colorWithAlpha, useAppThemeColors } from "@/shared/theme/app-theme";
import { FilledIcon, type FilledIconName } from "@/shared/ui/filled-icon";

/** The app's ease-out: quick start, soft landing. */
export const EASE_OUT = Easing.bezier(0.22, 1, 0.36, 1);

/** Rows that fade in one after another. */
export const rise = (index: number, base = 90) =>
  FadeIn.duration(440)
    .delay(base + Math.min(index, 8) * 65)
    .easing(EASE_OUT)
    .reduceMotion(ReduceMotion.System);

/** Marks and badges fade in. */
export const pop = (delay = 0) => FadeIn.duration(360).delay(delay).easing(EASE_OUT).reduceMotion(ReduceMotion.System);

/**
 * A 0→1 clock that loops for illustrations. With Reduce Motion it rests at
 * `rest`, so the still frame still tells the story.
 */
export function useLoop(duration: number, rest = 0.62) {
  const reduce = useReducedMotion();
  const progress = useSharedValue(reduce ? rest : 0);
  useEffect(() => {
    if (reduce) {
      cancelAnimation(progress);
      progress.value = rest;
      return;
    }
    progress.value = 0;
    progress.value = withRepeat(withTiming(1, { duration, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(progress);
  }, [reduce, duration, rest, progress]);
  return progress;
}

/** 0 before `from`, 1 after `to`, eased in between: one beat of a looped scene. */
export function beat(progress: number, from: number, to: number) {
  "worklet";
  const t = Math.min(1, Math.max(0, (progress - from) / (to - from)));
  return 1 - Math.pow(1 - t, 3);
}

/** Shown between `from` and `until`, fading in and out over `fade`. */
export function visibleBetween(progress: number, from: number, until: number, fade = 0.04) {
  "worklet";
  return beat(progress, from, from + fade) * (1 - beat(progress, until, until + fade));
}

/** Appears at `from` (rising by `lift`) and leaves at `until`. */
export function useBeatStyle(progress: SharedValue<number>, from: number, until = 0.94, lift = 10) {
  return useAnimatedStyle(() => {
    const shown = visibleBetween(progress.value, from, until);
    return { opacity: shown, transform: [{ translateY: (1 - beat(progress.value, from, from + 0.06)) * lift }] };
  });
}

/** The step's icon. It fades in, so the eye lands on the new question first. */
export function StepBadge({ icon, children }: { icon?: FilledIconName; children?: ReactNode }) {
  const theme = useAppThemeColors();
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ alignItems: "center", height: 76, justifyContent: "center", width: 76 }}>
      <Animated.View
        entering={pop(40)}
        style={{ alignItems: "center", backgroundColor: colorWithAlpha(theme.accent, 0.13), borderRadius: 34, height: 68, justifyContent: "center", width: 68 }}
      >
        {children ?? (icon ? <FilledIcon color={theme.accent} name={icon} size={32} /> : null)}
      </Animated.View>
    </View>
  );
}
