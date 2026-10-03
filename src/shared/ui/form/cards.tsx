import { useState, type ReactNode } from "react";
import { Keyboard, Pressable, View, type KeyboardTypeOptions } from "react-native";
import { useTranslation } from "react-i18next";

import { useAppLocalization } from "@/localization/localization-provider";

import { EditableInput } from "./editable-input";
import { Text } from "../app-text";
import { AppSwitch } from "../controls/app-switch";
import { DateTimePickerOverlay } from "../controls/date-time-picker-overlay";
import { FilledIcon, type FilledIconName } from "../filled-icon";

/**
 * Large standalone cards from the Plutus "new transaction" page: big inputs,
 * date / time cards, toggle cards. Use them for the main fields of an editor;
 * use FormSection rows for secondary settings.
 */

/** Small icon + label line shown at the top of a card. */
function CardLabel({ icon, label }: { icon?: FilledIconName; label: string }) {
  return (
    <View className="flex-row items-center gap-2">
      {icon ? <FilledIcon name={icon} size={17} tone="muted" /> : null}
      <Text className="flex-1 font-manrope-medium text-xs text-muted">
        {label}
      </Text>
    </View>
  );
}

/** Big Plutus input (h-16): text or amount, with an optional trailing element. */
export function InputCard({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  trailing,
  action,
  multiline,
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  keyboardType?: KeyboardTypeOptions;
  /** e.g. a currency code or "Custom" button on the end side. */
  trailing?: ReactNode;
  action?: ReactNode;
  multiline?: boolean;
}) {
  return (
    <View className={`justify-center gap-1 rounded-2xl bg-surface px-4 ${multiline ? "py-3" : "min-h-20 py-2"}`}>
      <View className="flex-row flex-wrap items-center justify-between gap-2">
        <View className="min-w-0 flex-1"><CardLabel label={label} /></View>
        {action}
      </View>
      <View className="gap-2">
        <EditableInput
          label={label}
          numeric={keyboardType === "decimal-pad" || keyboardType === "number-pad"}
          containerClassName="w-full"
          className={multiline ? "min-h-24 font-sans" : "text-lg"}
          keyboardType={keyboardType}
          multiline={multiline}
          placeholder={placeholder}
          trailing={trailing}
          style={{ textAlignVertical: multiline ? "top" : "center" }}
          value={value}
          onChangeText={onChangeText}
        />
      </View>
    </View>
  );
}

/** Plutus date / time card (h-20): icon + label, big value; opens the system picker. */
export function PickerCard({
  mode,
  label,
  display,
  value,
  onChange,
  icon,
  minimumDate,
  maximumDate,
  footnote,
}: {
  mode: "date" | "time";
  label: string;
  display: string;
  value: Date;
  onChange: (value: Date) => void;
  icon?: FilledIconName;
  minimumDate?: Date;
  maximumDate?: Date;
  /** Small text under the value, e.g. "Next day". */
  footnote?: string;
}) {
  const { t } = useTranslation();
  const { isRTL } = useAppLocalization();
  const [open, setOpen] = useState(false);
  return (
    <Pressable
      accessibilityHint={t("common.change", { field: label })}
      accessibilityLabel={`${label}: ${display}`}
      accessibilityRole="button"
      className="min-h-20 flex-1 justify-center gap-1 rounded-2xl bg-surface px-4 py-2"
      style={({ pressed }) => ({ opacity: pressed ? 0.68 : 1 })}
      onPress={() => {
        Keyboard.dismiss();
        setOpen(true);
      }}
    >
      <CardLabel icon={icon ?? (mode === "date" ? "calendar" : "clock")} label={label} />
      <Text className="font-manrope-semibold text-base text-foreground" numberOfLines={1} style={{ fontVariant: ["tabular-nums"], ...(mode === "time" ? { direction: "ltr" as const, writingDirection: "ltr" as const, textAlign: isRTL ? "left" as const : "right" as const } : {}) }}>
        {display}
      </Text>
      {footnote ? <Text className="font-sans text-xs text-accent">{footnote}</Text> : null}
      <DateTimePickerOverlay
        isPresented={open}
        maximumDate={maximumDate}
        minimumDate={minimumDate}
        mode={mode}
        title={label}
        value={value}
        onChange={onChange}
        onDismiss={() => setOpen(false)}
      />
    </Pressable>
  );
}

/** A card with a title, description and switch. */
export function ToggleCard({
  label,
  description,
  value,
  onValueChange,
  icon,
}: {
  label: string;
  description?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  icon?: FilledIconName;
}) {
  return (
    <View className="min-h-16 flex-row items-center gap-3 rounded-2xl bg-surface px-4 py-3">
      {icon ? <FilledIcon name={icon} size={23} tone={value ? "accent" : "foreground"} /> : null}
      <View className="min-w-0 flex-1">
        <Text className="font-manrope-semibold text-base text-foreground">{label}</Text>
        {description ? <Text className="font-sans text-xs leading-4 text-muted">{description}</Text> : null}
      </View>
      <AppSwitch accessibilityLabel={label} value={value} onValueChange={onValueChange} />
    </View>
  );
}

/** Two cards side by side. */
export function CardRow({ children }: { children: ReactNode }) {
  return <View className="flex-row gap-3">{children}</View>;
}

/** A small accent text button for card trailing slots ("Custom", "Use global"). */
export function CardAction({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      className="rounded-full bg-accent/12 px-3 py-1.5"
      hitSlop={6}
      style={({ pressed }) => ({ opacity: pressed ? 0.68 : 1 })}
      onPress={() => {
        Keyboard.dismiss();
        onPress();
      }}
    >
      <Text className="font-manrope-semibold text-xs text-accent">{label}</Text>
    </Pressable>
  );
}
