import { BlurTargetView } from "expo-blur";
import { router } from "expo-router";
import { useRef, useState, type PropsWithChildren, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { errorMessage } from "@/localization/errors";
import { i18n } from "@/localization/i18n";
import { useAppLocalization } from "@/localization/localization-provider";
import { colorWithAlpha, useAppThemeColors } from "@/shared/theme/app-theme";

import { Text, TextAlignmentProvider } from "../app-text";
import { ScreenHeader } from "../controls/screen-header";
import { FilledIcon, type FilledIconName } from "../filled-icon";
import { AppAlert } from "../overlay/app-alert";
import { BottomSafeAreaGradient, TopSafeAreaGradient } from "../safe-area-gradients";

const HEADER_HEIGHT = 56;
const TOP_CONTROL_HEIGHT = 64;
const ACTION_DOCK_SPACE = 148;
const ACTION_DOCK_BOTTOM_GAP = 10;

export type SecondaryAction = {
  icon: FilledIconName;
  label: string;
  onPress: () => void;
  tone?: "accent" | "danger";
};

type FormScreenProps = PropsWithChildren<{
  title: string;
  /** Primary action in the bottom dock. Return normally to close; throw to show the error and stay. */
  onSave?: () => Promise<unknown> | void;
  saveLabel?: string;
  saveIcon?: FilledIconName;
  /** A second, square button beside Save (e.g. delete). */
  secondaryAction?: SecondaryAction;
  /** Shown first, like Plutus' muted explanation text. */
  intro?: string;
  /** Pinned under the header (e.g. a GlassSegmentedControl). */
  topControl?: ReactNode;
  footer?: ReactNode;
  /** Close the screen after a successful save (default true). */
  closeOnSave?: boolean;
  onSaved?: () => void;
}>;

/**
 * The Plutus editor page, used by every pushed screen:
 * edge-to-edge scrolling content, a floating header (back + title) over a
 * top fade, an optional pinned control, and a floating action dock with the
 * Save button at the bottom. Same on iOS and Android.
 */
export function FormScreen({
  title,
  onSave,
  saveLabel,
  saveIcon = "save",
  secondaryAction,
  intro,
  topControl,
  footer,
  closeOnSave = true,
  onSaved,
  children,
}: FormScreenProps) {
  const { t } = useTranslation();
  const { direction } = useAppLocalization();
  const insets = useSafeAreaInsets();
  const theme = useAppThemeColors();
  const primaryLabel = saveLabel ?? t("common.save");
  const blurTarget = useRef<View | null>(null);
  const [saving, setSaving] = useState(false);
  const topSpace = insets.top + HEADER_HEIGHT + (topControl ? TOP_CONTROL_HEIGHT : 0) + 8;

  async function save() {
    if (!onSave || saving) return;
    setSaving(true);
    try {
      await onSave();
      onSaved?.();
      if (closeOnSave && router.canGoBack()) router.back();
    } catch (error) {
      AppAlert.alert(i18n.t("common.couldNotSave"), errorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <TextAlignmentProvider>
      <View style={{ direction, flex: 1, backgroundColor: theme.background }}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.fill}>
          <View style={styles.fill}>
            <BlurTargetView ref={blurTarget} style={styles.fill}>
              <ScrollView
                automaticallyAdjustKeyboardInsets
                contentContainerClassName="gap-5 px-5"
                contentContainerStyle={{
                  paddingTop: topSpace,
                  paddingBottom: (onSave ? ACTION_DOCK_SPACE + ACTION_DOCK_BOTTOM_GAP : 40) + insets.bottom,
                }}
                contentInsetAdjustmentBehavior="never"
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                {intro ? <Text className="px-1 font-sans text-sm leading-5 text-muted">{intro}</Text> : null}
                {children}
                {footer}
              </ScrollView>
            </BlurTargetView>

            <TopSafeAreaGradient />
            <View style={[styles.header, { top: insets.top }]}>
              <ScreenHeader disabled={saving} title={title} />
            </View>
            {topControl ? (
              <View style={[styles.topControl, { top: insets.top + HEADER_HEIGHT + 8 }]}>{topControl}</View>
            ) : null}

            {onSave ? (
              <>
                <BottomSafeAreaGradient />
                <View pointerEvents="box-none" style={[styles.dock, { bottom: insets.bottom + ACTION_DOCK_BOTTOM_GAP }]}>
                  <Pressable
                    accessibilityLabel={primaryLabel}
                    accessibilityRole="button"
                    accessibilityState={{ busy: saving, disabled: saving }}
                    android_ripple={{ color: colorWithAlpha(theme.accentForeground, 0.16) }}
                    disabled={saving}
                    style={({ pressed }) => [
                      styles.primary,
                      secondaryAction ? styles.primarySplit : styles.primaryAlone,
                      { backgroundColor: theme.accent },
                      saving && styles.disabled,
                      Platform.OS === "ios" && pressed && styles.pressed,
                    ]}
                    onPress={save}
                  >
                    <FilledIcon name={saveIcon} size={24} tone="accent-foreground" />
                    <Text className="shrink font-manrope-bold text-base text-accent-foreground" numberOfLines={1}>
                      {saving ? t("common.saving") : primaryLabel}
                    </Text>
                  </Pressable>
                  {secondaryAction ? (
                    <Pressable
                      accessibilityLabel={secondaryAction.label}
                      accessibilityRole="button"
                      disabled={saving}
                      style={({ pressed }) => [
                        styles.secondary,
                        { backgroundColor: secondaryAction.tone === "danger" ? theme.danger : theme.accent },
                        saving && styles.disabled,
                        pressed && styles.pressed,
                      ]}
                      onPress={secondaryAction.onPress}
                    >
                      <FilledIcon name={secondaryAction.icon} size={26} tone="accent-foreground" />
                    </Pressable>
                  ) : null}
                </View>
              </>
            ) : null}
          </View>
        </KeyboardAvoidingView>
      </View>
    </TextAlignmentProvider>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  header: { height: HEADER_HEIGHT, left: 16, position: "absolute", right: 16, zIndex: 20 },
  topControl: { left: 12, position: "absolute", right: 12, zIndex: 20 },
  dock: { flexDirection: "row", gap: 4, left: 0, paddingHorizontal: 12, position: "absolute", right: 0, zIndex: 20 },
  primary: {
    alignItems: "center",
    flex: 1,
    flexDirection: "row",
    gap: 10,
    height: 58,
    justifyContent: "center",
    overflow: "hidden",
    paddingHorizontal: 16,
  },
  primaryAlone: { borderRadius: 29 },
  primarySplit: {
    borderBottomEndRadius: 8,
    borderBottomStartRadius: 29,
    borderTopEndRadius: 8,
    borderTopStartRadius: 29,
  },
  secondary: {
    alignItems: "center",
    borderBottomEndRadius: 29,
    borderBottomStartRadius: 8,
    borderTopEndRadius: 29,
    borderTopStartRadius: 8,
    height: 58,
    justifyContent: "center",
    width: 68,
  },
  pressed: { opacity: 0.78 },
  disabled: { opacity: 0.5 },
});
