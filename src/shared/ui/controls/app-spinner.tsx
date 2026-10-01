import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import { useAppThemeColors } from "@/shared/theme/app-theme";

const SIZE = 26;

/** Android: a loading spinner built from scratch (no native ProgressBar). */
export function AppSpinner() {
  const { t } = useTranslation();
  const { accent } = useAppThemeColors();
  const rotation = useSharedValue(0);

  useEffect(() => {
    rotation.set(withRepeat(
      withTiming(360, { duration: 900, easing: Easing.linear, reduceMotion: ReduceMotion.Never }),
      -1,
    ));
  }, [rotation]);

  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${rotation.get()}deg` }] }));

  return (
    <Animated.View
      accessibilityLabel={t("common.loading")}
      accessibilityRole="progressbar"
      style={[
        {
          width: SIZE,
          height: SIZE,
          borderRadius: SIZE / 2,
          borderWidth: 3,
          borderColor: accent,
          borderTopColor: "transparent",
        },
        style,
      ]}
    />
  );
}
