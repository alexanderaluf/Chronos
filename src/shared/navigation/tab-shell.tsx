import { BlurTargetView } from "expo-blur";
import { Slot, usePathname, useRouter } from "expo-router";
import { useRef } from "react";
import { View } from "react-native";

import { useAppThemeColors } from "@/shared/theme/app-theme";

import { BottomNavigation } from "./bottom-navigation";
import { getTabFromPathname, navigationItems, type TabAction, type TabId } from "./navigation-config";

export type TabActions = Record<TabId, TabAction & { onPress: () => void }>;

/**
 * Renders the current tab with the floating bottom navigation on top.
 * The tab content is the blur target so the bar frosts what scrolls under it.
 * What the action button does is decided by the caller (`actions`).
 */
export function TabShell({ actions }: { actions: TabActions }) {
  const blurTargetRef = useRef<View | null>(null);
  const theme = useAppThemeColors();
  const pathname = usePathname();
  const router = useRouter();
  const activeItem = getTabFromPathname(pathname);
  const action = actions[activeItem];

  function handleTabChange(tabId: TabId) {
    const destination = navigationItems.find((item) => item.id === tabId);
    if (destination && tabId !== activeItem) router.replace(destination.href);
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <BlurTargetView ref={blurTargetRef} style={{ flex: 1 }}>
        <Slot />
      </BlurTargetView>

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
