import { useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, TextInput, View, type TextInputProps } from "react-native";

import { useAppLocalization } from "@/localization/localization-provider";
import { formatNumber } from "@/shared/lib/format";
import { useAppThemeColors } from "@/shared/theme/app-theme";

import { useRevealOnFocus } from "./form-scroll";

type EditableInputProps = TextInputProps & {
  label: string;
  numeric?: boolean;
  compact?: boolean;
  containerClassName?: string;
  trailing?: ReactNode;
  className?: string;
};

/** Shared editing affordance, including when a field already contains a value. */
export function EditableInput({
  label, numeric = false, compact = false, containerClassName, className,
  trailing, placeholder, editable = true, multiline, style, onFocus, onBlur, ...props
}: EditableInputProps) {
  const { t } = useTranslation();
  const { direction, isRTL, language } = useAppLocalization();
  const { accent, border, muted, surfaceSecondary } = useAppThemeColors();
  const input = useRef<TextInput>(null);
  const container = useRef<View>(null);
  const reveal = useRevealOnFocus();
  const [focused, setFocused] = useState(false);
  const inputDirection = numeric || props.keyboardType === "email-address" ? "ltr" : direction;
  const fallback = numeric ? formatNumber(0, { minimumFractionDigits: props.keyboardType === "decimal-pad" && !compact ? 2 : 0, maximumFractionDigits: 2 }, language) : t("inputs.placeholder", { field: label });

  return (
    <Pressable
      ref={container}
      accessible={false}
      disabled={!editable}
      className={`min-w-0 max-w-full flex-row gap-2 rounded-xl border ${multiline ? "items-start" : "items-center"} ${compact ? "min-h-11 px-2" : "min-h-12 px-3"} ${containerClassName ?? ""}`}
      style={{ direction: numeric ? "ltr" : direction, borderColor: editable ? focused ? accent : border : "transparent", backgroundColor: editable ? surfaceSecondary : "transparent" }}
      onPress={() => input.current?.focus()}
    >
      <TextInput
        {...props}
        ref={input}
        accessibilityLabel={props.accessibilityLabel ?? label}
        accessibilityHint={props.accessibilityHint ?? (editable ? t("inputs.editHint") : undefined)}
        accessibilityState={{ ...props.accessibilityState, disabled: !editable }}
        className={`min-w-0 flex-1 py-2 font-manrope-semibold text-base text-foreground ${className ?? ""}`}
        editable={editable}
        // Wrap long values and grow vertically instead of clipping them.
        multiline
        scrollEnabled={false}
        submitBehavior={multiline ? "newline" : "blurAndSubmit"}
        onChangeText={(text) => props.onChangeText?.(multiline ? text : text.replace(/[\r\n]+/g, " "))}
        placeholder={placeholder?.trim() ? placeholder : fallback}
        placeholderTextColor={muted}
        selectionColor={accent}
        underlineColorAndroid="transparent"
        style={[{ direction: "ltr", writingDirection: inputDirection, textAlign: isRTL ? numeric ? "left" : "right" : numeric ? "right" : "left", textAlignVertical: multiline ? "top" : "center" }, style]}
        onFocus={(event) => { setFocused(true); reveal(container.current); onFocus?.(event); }}
        onBlur={(event) => { setFocused(false); reveal(null); onBlur?.(event); }}
      />
      {trailing}
    </Pressable>
  );
}
