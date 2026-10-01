import { Children, isValidElement, type PropsWithChildren } from "react";
import { ScrollView, View } from "react-native";
import Animated, { Easing, FadeInDown, ReduceMotion } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BOTTOM_NAVIGATION_CLEARANCE } from "@/shared/navigation/bottom-navigation";

import { TopSafeAreaGradient } from "./safe-area-gradients";

const INITIAL_DELAY = 45;
const STAGGER_DELAY = 85;
const REVEAL_DURATION = 420;

/**
 * The scrolling body of every tab. It reaches every screen edge (edge-to-edge)
 * and pads its content so nothing hides under the status bar or the bottom
 * navigation. Each direct child is one section and fades in with a stagger.
 */
export function TabPage({ children }: PropsWithChildren) {
  const insets = useSafeAreaInsets();
  const sections = Children.toArray(children);

  return (
    <View className="flex-1 bg-background">
      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-6 px-5"
        contentContainerStyle={{
          paddingTop: insets.top + 12,
          paddingBottom: insets.bottom + BOTTOM_NAVIGATION_CLEARANCE,
        }}
        contentInsetAdjustmentBehavior="never"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {sections.map((section, index) => (
          <Animated.View
            key={isValidElement(section) && section.key != null ? section.key : `section-${index}`}
            entering={FadeInDown.duration(REVEAL_DURATION)
              .delay(INITIAL_DELAY + index * STAGGER_DELAY)
              .easing(Easing.bezier(0.22, 1, 0.36, 1))
              .reduceMotion(ReduceMotion.System)}
          >
            {section}
          </Animated.View>
        ))}
      </ScrollView>
      <TopSafeAreaGradient headerHidden />
    </View>
  );
}
