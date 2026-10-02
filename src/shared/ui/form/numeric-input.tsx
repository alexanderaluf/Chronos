import { useState } from "react";
import type { KeyboardTypeOptions } from "react-native";

import { parseMajorToMinor } from "@/domain/money/money";
import { useAppLocalization } from "@/localization/localization-provider";
import { currencyStatementParts } from "@/shared/lib/currency-display";
import { formatNumber, getAppLocale } from "@/shared/lib/format";

import { Text } from "../app-text";
import { EditableInput } from "./editable-input";

/** Format when idle; keep raw decimal input while editing so parsing and the caret stay stable. */
export function NumericInput({ value, onChangeText, label, placeholder, currencyCode, suffix, keyboardType = "decimal-pad", editable = true, compact = false }: {
  value: string;
  onChangeText: (value: string) => void;
  label: string;
  placeholder?: string;
  currencyCode?: string;
  suffix?: string;
  keyboardType?: KeyboardTypeOptions;
  editable?: boolean;
  compact?: boolean;
}) {
  const { isRTL, language } = useAppLocalization();
  const [editing, setEditing] = useState(false);
  // Subscribe to app language even while an unchanged numeric value is displayed.
  const locale = getAppLocale(language);
  const amount = parseMajorToMinor(value);
  const parts = currencyCode ? currencyStatementParts(amount ?? 0, currencyCode, locale) : undefined;
  const unit = parts?.symbol ?? suffix;
  let display = value;
  if (!editing && value.trim()) {
    if (parts && amount !== null) display = `${parts.sign}${parts.number}`;
    else if (!currencyCode && amount !== null && (keyboardType !== "number-pad" || /^\d+$/.test(value.trim()))) {
      display = formatNumber(Number(value.replace(",", ".")), { maximumFractionDigits: keyboardType === "number-pad" ? 0 : 2 }, language);
    }
  }

  return (
    <EditableInput
      numeric
      compact={compact}
      containerClassName="w-full"
      label={label}
      trailing={unit ? <Text className="shrink-0 text-base text-muted" style={{ direction: "ltr" }}>{unit}</Text> : undefined}
      editable={editable}
      keyboardType={keyboardType}
      placeholder={placeholder}
      selectTextOnFocus
      style={{ direction: "ltr", writingDirection: "ltr", textAlign: isRTL ? "left" : "right", fontVariant: ["tabular-nums"] }}
      value={display}
      onBlur={() => setEditing(false)}
      onChangeText={onChangeText}
      onFocus={() => setEditing(true)}
    />
  );
}
