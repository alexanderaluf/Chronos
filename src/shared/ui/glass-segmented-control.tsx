import { BlurView } from "expo-blur";
import type { RefObject } from "react";
import { Platform, Pressable, StyleSheet, View } from "react-native";

import { colorWithAlpha, useAppThemeColors } from "@/shared/theme/app-theme";
import { useAppLocalization } from "@/localization/localization-provider";

import { Text } from "./app-text";
import { SlidingIndicator, useIndicatorFrames } from "./sliding-indicator";

type SegmentOption<Value extends string> = { label: string; value: Value };

type GlassSegmentedControlProps<Value extends string> = {
  options: readonly SegmentOption<Value>[];
  value: Value;
  onChange: (value: Value) => void;
  accessibilityLabel?: string;
  /** Content behind the control, for the frosted look when it floats over a page. */
  blurTarget?: RefObject<View | null>;
  minHeight?: number;
};

/**
 * The Plutus segmented control: a glass pill with a sliding accent indicator.
 * A Plutus design element, so it is the same custom component on iOS and Android.
 */
export function GlassSegmentedControl<Value extends string>({
  options,
  value,
  onChange,
  accessibilityLabel,
  blurTarget,
  minHeight = 48,
}: GlassSegmentedControlProps<Value>) {
  const colors = useAppThemeColors();
  const { direction } = useAppLocalization();
  const { frames, onItemLayout } = useIndicatorFrames<Value>();

  return (
    <View
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="tablist"
      style={[styles.container, { backgroundColor: colorWithAlpha(colors.surface, 0.72), borderColor: colors.border }]}
    >
      {Platform.OS === "ios" || blurTarget ? (
        <BlurView
          blurMethod={Platform.OS === "android" ? "dimezisBlurViewSdk31Plus" : undefined}
          blurReductionFactor={3}
          blurTarget={blurTarget}
          intensity={36}
          pointerEvents="none"
          style={StyleSheet.absoluteFill}
          tint={colors.isDark ? "dark" : "light"}
        />
      ) : null}
      <View style={[styles.track, { direction }]}>
        <SlidingIndicator frame={frames[value]} style={[styles.indicator, { backgroundColor: colors.accent }]} />
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <Pressable
              key={option.value}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              style={({ pressed }) => [styles.tab, { minHeight }, pressed && styles.pressed]}
              onLayout={(event) => onItemLayout(option.value, event)}
              onPress={() => onChange(option.value)}
            >
              <Text
                adjustsFontSizeToFit
                className="font-manrope-bold"
                minimumFontScale={0.78}
                numberOfLines={1}
                style={{ color: selected ? colors.accentForeground : colors.foreground, fontSize: 14, textAlign: "center" }}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { borderRadius: 999, borderWidth: 1, overflow: "hidden" },
  track: { flexDirection: "row", margin: 4, position: "relative" },
  indicator: { borderRadius: 999 },
  tab: {
    alignItems: "center",
    borderRadius: 999,
    flex: 1,
    justifyContent: "center",
    minWidth: 0,
    paddingHorizontal: 8,
    zIndex: 1,
  },
  pressed: { opacity: 0.72 },
});
