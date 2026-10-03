import { router } from "expo-router";
import { Button } from "heroui-native";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Keyboard, View } from "react-native";
import { useAppLocalization } from "@/localization/localization-provider";

import { Text } from "../app-text";
import { FilledIcon } from "../filled-icon";

/**
 * The Plutus page header: a ghost back button and a bold title. A Plutus
 * design element, so it is the same custom component on iOS and Android
 * (the native stack header is never shown — see the root layout).
 */
export function ScreenHeader({
  title,
  right,
  onBack,
  disabled,
}: {
  title: string;
  /** Optional element on the end side. */
  right?: ReactNode;
  onBack?: () => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const { isRTL } = useAppLocalization();
  return (
    <View className="h-14 flex-row items-center gap-3" style={{ direction: "ltr" }}>
      <Button
        accessibilityLabel={t("common.back")}
        isDisabled={disabled}
        isIconOnly
        variant="ghost"
        onPress={() => {
          Keyboard.dismiss();
          if (onBack) onBack();
          else if (router.canGoBack()) router.back();
          else router.replace("/");
        }}
      >
        <FilledIcon name="arrow-left" size={24} />
      </Button>
      <Text accessibilityRole="header" className="flex-1 font-manrope-bold text-xl text-foreground" numberOfLines={1} style={{ direction: "ltr", textAlign: isRTL ? "right" : "left" }}>
        {title}
      </Text>
      {right}
    </View>
  );
}
