import { BlurView } from "expo-blur";
import { useEffect, useRef, useState, type RefObject } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { scheduleOnRN } from "react-native-worklets";

import { colorWithAlpha, useAppThemeColors } from "@/shared/theme/app-theme";
import { Text } from "@/shared/ui/app-text";
import { FilledIcon, type FilledIconName } from "@/shared/ui/filled-icon";
import { BottomSafeAreaGradient } from "@/shared/ui/safe-area-gradients";
import { SlidingIndicator, useIndicatorFrames } from "@/shared/ui/sliding-indicator";

import { navigationItems, type TabAction, type TabId } from "./navigation-config";

/** Space a scrolling page must leave at the bottom so content clears the bar. */
export const BOTTOM_NAVIGATION_CLEARANCE = 106;

type BottomNavigationProps = {
  activeItem: TabId;
  action: TabAction;
  blurTarget: RefObject<View | null>;
  onChange: (item: TabId) => void;
  onActionPress: () => void;
};

/**
 * The floating tab bar from Plutus: a blurred pill with a sliding selection
 * indicator, plus a round accent action button whose icon animates when the
 * action changes (per tab, or e.g. clock in → clock out).
 */
export function BottomNavigation({ activeItem, action, blurTarget, onChange, onActionPress }: BottomNavigationProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const colors = useAppThemeColors();
  const { frames: tabFrames, onItemLayout } = useIndicatorFrames<TabId>();
  const actionOpacity = useSharedValue(1);
  const actionTranslateY = useSharedValue(0);
  const [displayedIcon, setDisplayedIcon] = useState<FilledIconName>(action.icon);
  const targetIcon = useRef(action.icon);

  useEffect(() => {
    if (action.icon === displayedIcon) return;
    targetIcon.current = action.icon;

    const showNextIcon = () => {
      setDisplayedIcon(targetIcon.current);
      actionTranslateY.value = -12;
      requestAnimationFrame(() => {
        actionTranslateY.value = withTiming(0, { duration: 220, easing: Easing.out(Easing.cubic) });
        actionOpacity.value = withTiming(1, { duration: 190, easing: Easing.out(Easing.quad) });
      });
    };

    actionTranslateY.value = withTiming(12, { duration: 150, easing: Easing.in(Easing.cubic) });
    actionOpacity.value = withTiming(0, { duration: 120, easing: Easing.in(Easing.quad) }, (finished) => {
      if (finished) scheduleOnRN(showNextIcon);
    });
  }, [action.icon, actionOpacity, actionTranslateY, displayedIcon]);

  const actionIconStyle = useAnimatedStyle(() => ({
    opacity: actionOpacity.value,
    transform: [{ translateY: actionTranslateY.value }],
  }));

  return (
    <>
      <BottomSafeAreaGradient fadeHeight={128} />

      <View style={[styles.dock, { bottom: Math.max(insets.bottom, 10) }]}>
        <View
          style={[
            styles.navigationPill,
            { backgroundColor: colorWithAlpha(colors.surface, 0.78), borderColor: colors.border },
          ]}
        >
          <BlurView
            blurMethod="dimezisBlurViewSdk31Plus"
            blurReductionFactor={3}
            blurTarget={blurTarget}
            intensity={36}
            pointerEvents="none"
            style={StyleSheet.absoluteFill}
            tint={colors.isDark ? "dark" : "light"}
          />

          <View accessibilityRole="tablist" style={styles.tabsTrack}>
            <SlidingIndicator
              frame={tabFrames[activeItem]}
              style={[styles.activeIndicator, { backgroundColor: colorWithAlpha(colors.foreground, 0.14) }]}
            />

            {navigationItems.map((item) => {
              const isActive = item.id === activeItem;
              const color = isActive ? colors.accent : colors.foreground;

              return (
                <Pressable
                  key={item.id}
                  accessibilityLabel={t(`tabs.${item.id}`)}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: isActive }}
                  hitSlop={4}
                  onLayout={(event) => onItemLayout(item.id, event)}
                  onPress={() => onChange(item.id)}
                  style={({ pressed }) => [styles.tab, pressed && styles.pressed]}
                >
                  <FilledIcon color={color} name={item.icon} size={24} weight={item.id === "stats" ? 600 : 400} />
                  <Text allowFontScaling={false} numberOfLines={1} style={[styles.label, { color }]}>
                    {t(`tabs.${item.id}`)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <Pressable
          accessibilityLabel={action.label}
          accessibilityRole="button"
          onPress={onActionPress}
          style={({ pressed }) => [styles.actionButton, { backgroundColor: colors.accent }, pressed && styles.pressed]}
        >
          <Animated.View style={[styles.actionIcon, actionIconStyle]}>
            <FilledIcon color={colors.accentForeground} name={displayedIcon} size={29} weight={600} />
          </Animated.View>
        </Pressable>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  dock: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    left: 0,
    paddingHorizontal: 12,
    position: "absolute",
    right: 0,
    zIndex: 20,
  },
  navigationPill: {
    alignItems: "stretch",
    backgroundColor: "transparent",
    borderRadius: 30,
    borderWidth: 1,
    flex: 1,
    flexDirection: "row",
    height: 58,
    overflow: "hidden",
  },
  tabsTrack: {
    flex: 1,
    flexDirection: "row",
    margin: 3,
  },
  tab: {
    alignItems: "center",
    borderRadius: 26,
    flex: 1,
    gap: 1,
    justifyContent: "center",
    minWidth: 0,
  },
  activeIndicator: {
    borderRadius: 26,
  },
  label: {
    fontSize: 10.5,
    lineHeight: 14,
    textAlign: "center",
    width: "100%",
  },
  actionButton: {
    alignItems: "center",
    borderRadius: 29,
    height: 58,
    justifyContent: "center",
    overflow: "hidden",
    width: 58,
  },
  actionIcon: {
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: { opacity: 0.72 },
});
