import { BlurTargetView } from "expo-blur";
import { Slot, usePathname, useRouter } from "expo-router";
import { useRef, type ReactNode } from "react";
import { StyleSheet, View, type ViewInstance } from "react-native";
import { SafeAreaInsetsContext, useSafeAreaInsets } from "react-native-safe-area-context";

import { useAppLocalization } from "@/localization/localization-provider";
import { useAppThemeColors } from "@/shared/theme/app-theme";
import { TopSafeAreaGradient } from "@/shared/ui/safe-area-gradients";

import { BottomNavigation } from "./bottom-navigation";
import { getTabFromPathname, navigationItems, type TabAction, type TabId } from "./navigation-config";

export type TabActions = Record<TabId, TabAction & { onPress: () => void }>;

/** Height of the floating tab header, under the status bar. */
const TAB_HEADER_HEIGHT = 56;

/**
 * Renders the current tab with the floating bottom navigation on top.
 * The tab content is the blur target so the bar frosts what scrolls under it.
 * What the action button does is decided by the caller (`actions`), and so
 * is the `header`: it floats over the tabs on the same top fade as every
 * other header, and is rendered once, so it does not reload when the tab
 * changes. The tabs see the header as part of the top safe area, so their
 * content starts below it and scrolls under the fade.
 */
export function TabShell({ actions, header }: { actions: TabActions; header?: ReactNode }) {
  const blurTargetRef = useRef<ViewInstance | null>(null);
  const insets = useSafeAreaInsets();
  const theme = useAppThemeColors();
  const { direction } = useAppLocalization();
  const pathname = usePathname();
  const router = useRouter();
  const activeItem = getTabFromPathname(pathname);
  const action = actions[activeItem];

  function handleTabChange(tabId: TabId) {
    const destination = navigationItems.find((item) => item.id === tabId);
    if (destination && tabId !== activeItem) router.replace(destination.href);
  }

  return (
    <View style={{ direction, flex: 1, backgroundColor: theme.background }}>
      <BlurTargetView ref={blurTargetRef} style={{ flex: 1 }}>
        <SafeAreaInsetsContext.Provider value={header ? { ...insets, top: insets.top + TAB_HEADER_HEIGHT } : insets}>
          <Slot />
        </SafeAreaInsetsContext.Provider>
      </BlurTargetView>

      {header ? (
        <>
          <TopSafeAreaGradient />
          <View style={[styles.header, { top: insets.top }]}>{header}</View>
        </>
      ) : null}

      <BottomNavigation
        action={action}
        activeItem={activeItem}
        blurTarget={blurTargetRef}
        onActionPress={action.onPress}
        onChange={handleTabChange}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  header: { height: TAB_HEADER_HEIGHT, justifyContent: "center", left: 0, position: "absolute", right: 0, zIndex: 20 },
});
