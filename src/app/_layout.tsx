import "../../global.css";

import { Huninn_400Regular } from "@expo-google-fonts/huninn/400Regular";
import { useFonts } from "expo-font";
import { NavigationBar } from "expo-navigation-bar";
import { DarkTheme, DefaultTheme, Stack, ThemeProvider, type ErrorBoundaryProps, type Theme } from "expo-router";
import { SQLiteProvider } from "expo-sqlite";
import { StatusBar } from "expo-status-bar";
import * as SystemUI from "expo-system-ui";
import { useEffect } from "react";
import { Pressable, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useUniwind } from "uniwind";

import { DATABASE_NAME, initializeDatabase } from "@/data/database/initialize-database";
import { i18n } from "@/localization/i18n";
import { LocalizationProvider } from "@/localization/localization-provider";
import { AppThemeController, ROOT_BACKGROUNDS, useAppThemeColors } from "@/shared/theme/app-theme";
import { Text } from "@/shared/ui/app-text";
import { AppAlertHost } from "@/shared/ui/overlay/app-alert-host";
import { PortalProvider } from "@/shared/ui/overlay/portal";

/**
 * Root providers, outermost first:
 * gestures → safe areas → local database → localization (language, RTL, HeroUI)
 * → overlay portal → theme → navigation.
 * The portal layer hosts the Android sheets and dialogs (iOS uses native ones).
 * The database is opened and migrated (`initializeDatabase`) before any screen renders.
 */
export default function RootLayout() {
  const { theme } = useUniwind();
  const [fontsLoaded, fontError] = useFonts({ Huninn_400Regular });

  if (!fontsLoaded && !fontError) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: ROOT_BACKGROUNDS[theme === "dark" ? "dark" : "light"] }}>
      <SafeAreaProvider>
        <SQLiteProvider databaseName={DATABASE_NAME} onInit={initializeDatabase} options={{ enableChangeListener: true }}>
          <LocalizationProvider>
            <PortalProvider>
              <AppThemeController />
              <AppSystemBars />
              <AppNavigation />
              <AppAlertHost />
            </PortalProvider>
          </LocalizationProvider>
        </SQLiteProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function AppNavigation() {
  const { accent, background, border, danger, foreground, isDark } = useAppThemeColors();
  const base = isDark ? DarkTheme : DefaultTheme;
  const navigationTheme: Theme = {
    ...base,
    colors: { ...base.colors, primary: accent, background, card: background, text: foreground, border, notification: danger },
  };

  return (
    <ThemeProvider value={navigationTheme}>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: background },
          headerStyle: { backgroundColor: background },
          headerShadowVisible: false,
          headerTintColor: accent,
          headerTitleStyle: { color: foreground, fontFamily: "Huninn_400Regular" },
        }}
      />
    </ThemeProvider>
  );
}

function AppSystemBars() {
  const { background, isDark } = useAppThemeColors();
  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(background);
  }, [background]);

  return (
    <>
      <StatusBar style={isDark ? "light" : "dark"} />
      <NavigationBar style={isDark ? "light" : "dark"} />
    </>
  );
}

/** Shown if the database cannot be opened safely. Never resets data. */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return (
    <View className="flex-1 items-center justify-center gap-4 bg-background p-8">
      <Text className="text-center text-xl">{i18n.t("common.somethingWentWrong")}</Text>
      <Text className="text-center text-muted">{error.message}</Text>
      <Pressable accessibilityRole="button" className="rounded-full bg-accent px-6 py-3" onPress={retry}>
        <Text className="text-accent-foreground">{i18n.t("common.tryAgain")}</Text>
      </Pressable>
    </View>
  );
}
