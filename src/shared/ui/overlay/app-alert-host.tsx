import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { BackHandler, Pressable, ScrollView, StyleSheet, View, type AlertButton } from "react-native";
import Animated, { FadeIn, FadeOut, ReduceMotion, ZoomIn } from "react-native-reanimated";

import { useAppThemeColors } from "@/shared/theme/app-theme";

import { Text } from "../app-text";
import { FilledIcon } from "../filled-icon";
import { setAlertHostWaker, takeNextAlert, type AlertRequest } from "./app-alert";
import { Portal } from "./portal";

/**
 * Android: the app's own alert dialog, built from scratch (no native dialog,
 * no RN `Modal`). Mount once inside `PortalProvider`; dialogs render in the
 * portal layer, above any open sheet.
 * Requests come from `AppAlert.alert` and are shown one at a time.
 */
export function AppAlertHost() {
  const { t } = useTranslation();
  const theme = useAppThemeColors();
  const [request, setRequest] = useState<AlertRequest | null>(null);

  useEffect(() => {
    const wake = () => setRequest((current) => current ?? takeNextAlert());
    setAlertHostWaker(wake);
    wake();
    return () => setAlertHostWaker(null);
  }, []);

  const buttons: AlertButton[] = request?.buttons?.length ? request.buttons : [{ text: t("common.ok") }];
  const cancel = buttons.find((button) => button.style === "cancel");

  function press(button?: AlertButton) {
    setRequest(takeNextAlert());
    button?.onPress?.();
  }

  // Back = the cancel button, if there is one.
  useEffect(() => {
    if (!request) return;
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      if (cancel) press(cancel);
      return true;
    });
    return () => subscription.remove();
  });

  if (!request) return null;
  const actions = buttons.filter((button) => button.style !== "cancel");
  const destructive = actions.some((button) => button.style === "destructive");

  return (
    <Portal>
      <View style={[StyleSheet.absoluteFill, styles.center]}>
        <Animated.View
          entering={FadeIn.duration(160).reduceMotion(ReduceMotion.System)}
          exiting={FadeOut.duration(120).reduceMotion(ReduceMotion.System)}
          style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0,0,0,0.45)" }]}
        >
          <Pressable
            accessibilityLabel={t("common.close")}
            disabled={!cancel}
            style={StyleSheet.absoluteFill}
            onPress={() => press(cancel)}
          />
        </Animated.View>
        <Animated.View
          accessibilityViewIsModal
          entering={ZoomIn.duration(180).reduceMotion(ReduceMotion.System)}
          style={[styles.dialog, { backgroundColor: theme.surface }]}
        >
          <View
            style={[
              styles.icon,
              { backgroundColor: destructive ? "rgba(199,71,59,0.15)" : "rgba(8,126,139,0.15)" },
            ]}
          >
            <FilledIcon name={destructive ? "delete" : "info"} size={26} tone={destructive ? "danger" : "accent"} />
          </View>
          <View style={{ gap: 8 }}>
            <Text accessibilityRole="header" className="text-xl">
              {request.title}
            </Text>
            {request.message ? (
              <ScrollView style={{ maxHeight: 260 }}>
                <Text className="text-base text-muted">{request.message}</Text>
              </ScrollView>
            ) : null}
          </View>
          <View style={{ gap: 10 }}>
            {actions.map((button, index) => (
              <Pressable
                key={`${index}-${button.text}`}
                accessibilityRole="button"
                className={`min-h-12 items-center justify-center rounded-2xl px-4 active:opacity-80 ${
                  button.style === "destructive" ? "bg-danger" : "bg-accent"
                }`}
                onPress={() => press(button)}
              >
                <Text className={button.style === "destructive" ? "text-danger-foreground" : "text-accent-foreground"}>
                  {button.text ?? t("common.ok")}
                </Text>
              </Pressable>
            ))}
            {cancel ? (
              <Pressable
                accessibilityRole="button"
                className="min-h-12 items-center justify-center rounded-2xl bg-surface-secondary px-4 active:opacity-70"
                onPress={() => press(cancel)}
              >
                <Text>{cancel.text ?? t("common.cancel")}</Text>
              </Pressable>
            ) : null}
          </View>
        </Animated.View>
      </View>
    </Portal>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center", padding: 24 },
  dialog: { borderRadius: 28, gap: 20, maxWidth: 420, padding: 24, width: "100%" },
  icon: { alignItems: "center", borderRadius: 17, height: 48, justifyContent: "center", width: 48 },
});
