import { Pressable, View } from "react-native";
import { useTranslation } from "react-i18next";

import { Text } from "./app-text";
import { FilledIcon } from "./filled-icon";

type PeriodSwitcherProps = {
  label: string;
  onPrevious: () => void;
  onNext: () => void;
  onReset?: () => void;
};

/** "‹  October 2026  ›" — moves between months / pay periods. */
export function PeriodSwitcher({ label, onPrevious, onNext, onReset }: PeriodSwitcherProps) {
  const { t } = useTranslation();
  return (
    <View className="flex-row items-center justify-between rounded-full bg-surface p-1">
      <Pressable
        accessibilityLabel={t("common.previousMonth")}
        accessibilityRole="button"
        className="size-10 items-center justify-center rounded-full active:opacity-70"
        hitSlop={6}
        onPress={onPrevious}
      >
        <FilledIcon name="chevron-left" size={24} />
      </Pressable>
      <Pressable accessibilityRole="button" disabled={!onReset} onPress={onReset}>
        <Text className="text-base">{label}</Text>
      </Pressable>
      <Pressable
        accessibilityLabel={t("common.nextMonth")}
        accessibilityRole="button"
        className="size-10 items-center justify-center rounded-full active:opacity-70"
        hitSlop={6}
        onPress={onNext}
      >
        <FilledIcon name="chevron-right" size={24} />
      </Pressable>
    </View>
  );
}
