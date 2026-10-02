import { Pressable, View } from "react-native";
import { useTranslation } from "react-i18next";
import Animated, { FadeInDown, FadeOutUp, LinearTransition, ReduceMotion } from "react-native-reanimated";

import { useAppLocalization } from "@/localization/localization-provider";
import { colorWithAlpha, useAppThemeColors } from "@/shared/theme/app-theme";

import { Text } from "../app-text";
import { FilledIcon, type FilledIconName } from "../filled-icon";

export type SelectionOption = {
  id: string;
  name: string;
  /** A small color dot before the name. */
  color?: string;
  /** Secondary text after the name, e.g. "07:00–15:00". */
  detail?: string;
};

/**
 * The Plutus expandable selection row (from the "new transaction" page):
 * icon, title and current choice; tap to reveal choice chips.
 */
export function SelectionSection({
  title,
  placeholder,
  icon,
  options,
  selectedId,
  expanded,
  optional,
  onToggle,
  onSelect,
  onAdd,
  addLabel,
}: {
  title: string;
  placeholder: string;
  icon: FilledIconName;
  options: SelectionOption[];
  selectedId: string;
  expanded: boolean;
  optional?: boolean;
  onToggle: () => void;
  /** Receives "" when the selected chip is tapped again. */
  onSelect: (id: string) => void;
  onAdd?: () => void;
  addLabel?: string;
}) {
  const { t } = useTranslation();
  const { direction, isRTL } = useAppLocalization();
  const theme = useAppThemeColors();
  const selected = options.find((option) => option.id === selectedId);

  return (
    <Animated.View style={{ direction }} className="border-b border-border pb-4" layout={LinearTransition.duration(220).reduceMotion(ReduceMotion.System)}>
      <Pressable
        accessibilityLabel={expanded ? t("common.collapse", { title }) : t("common.expand", { title })}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        className="min-h-14 flex-row items-center gap-3 py-1"
        style={({ pressed }) => ({ opacity: pressed ? 0.68 : 1 })}
        onPress={onToggle}
      >
        <View className="size-9 items-center justify-center">
          <FilledIcon name={icon} size={25} tone={expanded ? "accent" : "foreground"} />
        </View>
        <View className="min-w-0 flex-1 gap-0.5">
          <Text className="font-manrope-semibold text-base text-foreground">
            {title}
            {optional ? <Text className="font-sans text-sm text-muted"> {t("common.optional")}</Text> : null}
          </Text>
          <Text className={`font-sans text-sm ${selected ? "text-accent" : "text-muted"}`} numberOfLines={1}>
            {selected ? `${selected.name}${selected.detail ? ` · ${selected.detail}` : ""}` : placeholder}
          </Text>
        </View>
        <FilledIcon
          name="chevron-right"
          size={24}
          style={{ transform: [{ rotate: expanded ? (isRTL ? "90deg" : "-90deg") : (isRTL ? "-90deg" : "90deg") }] }}
          tone={expanded ? "accent" : "foreground"}
        />
      </Pressable>

      {expanded ? (
        <Animated.View
          className="flex-row flex-wrap gap-2 pt-2"
          entering={FadeInDown.duration(220)
            .withInitialValues({ opacity: 0, transform: [{ translateY: -8 }] })
            .reduceMotion(ReduceMotion.System)}
          exiting={FadeOutUp.duration(160).reduceMotion(ReduceMotion.System)}
        >
          {options.map((option) => {
            const isSelected = option.id === selectedId;
            return (
              <Pressable
                key={option.id}
                accessibilityRole="radio"
                accessibilityState={{ checked: isSelected }}
                className="min-h-11 max-w-full flex-row items-center gap-2 rounded-full border px-3"
                style={({ pressed }) => ({
                  backgroundColor: isSelected ? colorWithAlpha(theme.accent, 0.14) : theme.surface,
                  borderColor: isSelected ? theme.accent : theme.border,
                  opacity: pressed ? 0.68 : 1,
                })}
                onPress={() => onSelect(isSelected ? "" : option.id)}
              >
                {option.color ? <View className="size-3.5 rounded-full" style={{ backgroundColor: option.color }} /> : null}
                <Text className={`max-w-48 font-manrope-medium text-sm ${isSelected ? "text-accent" : "text-foreground"}`} numberOfLines={1}>
                  {option.name}
                </Text>
                {option.detail ? <Text className="font-sans text-xs text-muted">{option.detail}</Text> : null}
              </Pressable>
            );
          })}
          {!options.length && !onAdd ? <Text className="py-2 font-sans text-sm text-muted">{t("common.nothingYet")}</Text> : null}
          {onAdd ? (
            <Pressable
              accessibilityRole="button"
              className="h-11 flex-row items-center gap-2 rounded-full border border-border bg-surface px-3"
              style={({ pressed }) => ({ opacity: pressed ? 0.68 : 1 })}
              onPress={onAdd}
            >
              <View className="size-6 items-center justify-center rounded-full border border-accent">
                <FilledIcon name="add" size={17} tone="accent" />
              </View>
              <Text className="font-manrope-medium text-sm text-foreground">{addLabel ?? t("common.add")}</Text>
            </Pressable>
          ) : null}
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}
