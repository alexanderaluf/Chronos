import { useState, type PropsWithChildren } from "react";
import { StyleSheet, View } from "react-native";

import { useSettings } from "@/data/hooks/queries";
import { useAppThemeColors } from "@/shared/theme/app-theme";

import { OnboardingScreen } from "./onboarding-screen";

/**
 * First-run setup drawn over the app until `settings.onboardingCompletedAt`
 * is saved. The app stays mounted beneath it (so the last screen can open the
 * shift editor and fade away onto it) but is hidden from screen readers.
 * Setup keeps the same place in the tree, so a language change never resets it.
 */
export function OnboardingGate({ children }: PropsWithChildren) {
  const settings = useSettings();
  const { background } = useAppThemeColors();
  const [holding, setHolding] = useState(false);
  const needed = settings.data ? settings.data.onboardingCompletedAt === null : false;
  const show = holding || needed;
  return (
    <>
      <View accessibilityElementsHidden={show} importantForAccessibility={show ? "no-hide-descendants" : "auto"} style={styles.fill}>
        {children}
      </View>
      {/* Until the settings load, cover the app so it never flashes before setup. */}
      {settings.status === "loading" ? <View style={[StyleSheet.absoluteFill, { backgroundColor: background }]} /> : null}
      {show ? (
        <View style={StyleSheet.absoluteFill}>
          <OnboardingScreen onHoldChange={setHolding} />
        </View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
