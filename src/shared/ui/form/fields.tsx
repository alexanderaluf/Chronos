import type { PropsWithChildren, ReactNode } from "react";
import { Pressable, TextInput, View, type KeyboardTypeOptions } from "react-native";
import Animated, { Easing, FadeInDown, ReduceMotion } from "react-native-reanimated";

import { useAppThemeColors } from "@/shared/theme/app-theme";

import { Text } from "../app-text";
import { AppSwitch } from "../controls/app-switch";
import { FilledIcon, type FilledIconName } from "../filled-icon";
import { GlassSegmentedControl } from "../glass-segmented-control";

/**
 * Form building blocks in the Plutus design. Every field is controlled and
 * stores user input as a string; parse it (e.g. `parseMajorToMinor`) only
 * when saving.
 *
 * Rows inside a FormSection sit on one `rounded-[28px]` surface, separated by
 * a thin background-colored line (`border-b-2 border-background`). Custom rows
 * written in screens should use the same classes.
 */

const reveal = FadeInDown.duration(400).easing(Easing.bezier(0.22, 1, 0.36, 1)).reduceMotion(ReduceMotion.System);

/** A titled group: bold title, optional description, rows on a rounded surface. */
export function FormSection({
  title,
  description,
  footnote,
  children,
}: PropsWithChildren<{ title?: string; description?: string; footnote?: string }>) {
  return (
    <Animated.View className="gap-3" entering={reveal}>
      {title || description ? (
        <View className="gap-1 px-1">
          {title ? <Text className="font-manrope-bold text-lg text-foreground">{title}</Text> : null}
          {description ? <Text className="font-sans text-sm leading-5 text-muted">{description}</Text> : null}
        </View>
      ) : null}
      <View className="overflow-hidden rounded-[28px] bg-surface">{children}</View>
      {footnote ? <Text className="px-1 font-sans text-xs leading-4 text-muted">{footnote}</Text> : null}
    </Animated.View>
  );
}

/** One row inside a FormSection: label on the start side, control on the end side. */
export function FieldRow({ label, hint, children }: PropsWithChildren<{ label: string; hint?: string }>) {
  return (
    <View className="min-h-16 flex-row items-center gap-3 border-b-2 border-background px-4 py-3">
      <View className="min-w-0 flex-1">
        <Text className="font-manrope-semibold text-base text-foreground">{label}</Text>
        {hint ? <Text className="mt-0.5 font-sans text-xs leading-4 text-muted">{hint}</Text> : null}
      </View>
      <View className="max-w-[55%] shrink-0 items-end">{children}</View>
    </View>
  );
}

type TextFieldProps = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  hint?: string;
  keyboardType?: KeyboardTypeOptions;
  /** Text after the input, e.g. "₪", "%", "h". */
  suffix?: string;
  multiline?: boolean;
};

/** Label + inline text input. Numeric fields align their value to the end. */
export function TextField({ label, value, onChangeText, placeholder, hint, keyboardType, suffix, multiline }: TextFieldProps) {
  const { muted } = useAppThemeColors();
  const numeric = keyboardType === "decimal-pad" || keyboardType === "number-pad";

  if (multiline) {
    return (
      <View className="gap-1 border-b-2 border-background px-4 py-3">
        <Text className="font-manrope-semibold text-base text-foreground">{label}</Text>
        <TextInput
          multiline
          className="min-h-20 font-sans text-base text-foreground"
          placeholder={placeholder}
          placeholderTextColor={muted}
          style={{ textAlignVertical: "top" }}
          value={value}
          onChangeText={onChangeText}
        />
      </View>
    );
  }

  return (
    <FieldRow hint={hint} label={label}>
      <View className="flex-row items-center gap-1">
        <TextInput
          accessibilityLabel={label}
          className={`min-w-16 shrink font-manrope-semibold text-base text-foreground ${numeric ? "text-right" : ""}`}
          keyboardType={keyboardType}
          placeholder={placeholder}
          placeholderTextColor={muted}
          selectTextOnFocus={numeric}
          style={{ fontVariant: numeric ? ["tabular-nums"] : undefined }}
          value={value}
          onChangeText={onChangeText}
        />
        {suffix ? <Text className="font-sans text-base text-muted">{suffix}</Text> : null}
      </View>
    </FieldRow>
  );
}

/** A switch row (native toggle on iOS, custom on Android — see AppSwitch). */
export function SwitchField({
  label,
  hint,
  value,
  onValueChange,
}: {
  label: string;
  hint?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
}) {
  return (
    <FieldRow hint={hint} label={label}>
      <AppSwitch accessibilityLabel={label} value={value} onValueChange={onValueChange} />
    </FieldRow>
  );
}

/** The Plutus glass segmented control in a row, for 2–4 short options. */
export function SegmentedField<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label?: string;
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <View className="gap-2 border-b-2 border-background px-3 py-3">
      {label ? <Text className="px-1 font-manrope-semibold text-base text-foreground">{label}</Text> : null}
      <GlassSegmentedControl accessibilityLabel={label} minHeight={44} options={options} value={value} onChange={onChange} />
    </View>
  );
}

/** A Plutus settings row: colored icon tile, title, description. Navigates on press. */
export function LinkRow({
  label,
  hint,
  icon,
  iconBackground,
  value,
  onPress,
}: {
  label: string;
  hint?: string;
  icon?: FilledIconName;
  /** Tile color behind the icon (Plutus pastel). Without it the icon is plain. */
  iconBackground?: string;
  value?: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityHint={hint}
      accessibilityRole="button"
      className="min-h-19 flex-row items-center border-b-2 border-background px-4 py-3"
      style={({ pressed }) => ({ opacity: pressed ? 0.72 : 1 })}
      onPress={onPress}
    >
      {icon ? (
        iconBackground ? (
          <View className="size-12 items-center justify-center rounded-[14px]" style={{ backgroundColor: iconBackground }}>
            <FilledIcon color="#090909" name={icon} size={27} />
          </View>
        ) : (
          <FilledIcon name={icon} size={24} tone="accent" />
        )
      ) : null}
      <View className={`min-w-0 flex-1 justify-center ${icon ? "ms-4" : ""}`}>
        <Text className="font-manrope-semibold text-[17px] leading-6 text-foreground">{label}</Text>
        {hint ? <Text className="mt-0.5 font-sans text-sm leading-5 text-muted">{hint}</Text> : null}
      </View>
      {value ? (
        <Text className="ms-2 max-w-[35%] font-manrope-medium text-sm text-muted" numberOfLines={1}>
          {value}
        </Text>
      ) : null}
      <FilledIcon name="chevron-right" size={22} tone="muted" />
    </Pressable>
  );
}

/** A full-width row that adds something ("+ Add bonus"). */
export function AddRow({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      className="min-h-14 flex-row items-center gap-3 px-4 py-3"
      style={({ pressed }) => ({ opacity: pressed ? 0.68 : 1 })}
      onPress={onPress}
    >
      <View className="size-6 items-center justify-center rounded-full border border-accent">
        <FilledIcon name="add" size={17} tone="accent" />
      </View>
      <Text className="font-manrope-semibold text-base text-accent">{label}</Text>
    </Pressable>
  );
}

/** A Plutus pill button inside forms. */
export function FormButton({
  label,
  onPress,
  tone = "accent",
  icon,
}: {
  label: string;
  onPress: () => void;
  tone?: "accent" | "danger" | "neutral";
  icon?: FilledIconName;
}) {
  const classes = {
    accent: ["bg-accent", "text-accent-foreground", "accent-foreground"],
    danger: ["bg-danger/15", "text-danger", "danger"],
    neutral: ["bg-surface", "text-foreground", "foreground"],
  }[tone] as [string, string, "accent-foreground" | "danger" | "foreground"];
  return (
    <Pressable
      accessibilityRole="button"
      className={`min-h-14 flex-row items-center justify-center gap-2 rounded-full px-5 ${classes[0]}`}
      style={({ pressed }) => ({ opacity: pressed ? 0.72 : 1 })}
      onPress={onPress}
    >
      {icon ? <FilledIcon name={icon} size={22} tone={classes[2]} /> : null}
      <Text className={`font-manrope-bold text-base ${classes[1]}`}>{label}</Text>
    </Pressable>
  );
}

/** Explanation text inside a section, styled like Plutus helper copy. */
export function HelperText({ children }: { children: ReactNode }) {
  return <Text className="px-1 font-sans text-sm leading-5 text-muted">{children}</Text>;
}
