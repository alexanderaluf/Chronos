import { useState } from "react";
import { Keyboard, Pressable } from "react-native";
import { useTranslation } from "react-i18next";

import { formatMinuteOfDay } from "@/domain/time/time";
import { getAppLocale } from "@/shared/lib/format";

import { Text } from "../app-text";
import { DateTimePickerOverlay } from "../controls/date-time-picker-overlay";
import { FieldRow } from "./fields";

/**
 * Date and time rows for forms. Tapping the value opens the system picker:
 * a native SwiftUI popover on iOS, the native Material dialog on Android.
 */

export function formatPickerDate(date: Date) {
  return date.toLocaleDateString(getAppLocale(), { day: "numeric", month: "short", year: "numeric" });
}

/** The tappable value pill; the picker anchors to it. */
function PickerValue({
  mode,
  label,
  value,
  display,
  onChange,
  minimumDate,
  maximumDate,
}: {
  mode: "date" | "time";
  label: string;
  value: Date;
  display: string;
  onChange: (value: Date) => void;
  minimumDate?: Date;
  maximumDate?: Date;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  return (
    <Pressable
      accessibilityHint={t("common.change", { field: label })}
      accessibilityRole="button"
      className="rounded-full bg-background px-4 py-2"
      style={({ pressed }) => ({ opacity: pressed ? 0.68 : 1 })}
      onPress={() => {
        Keyboard.dismiss();
        setOpen(true);
      }}
    >
      <Text className="font-manrope-semibold text-base text-foreground" style={{ fontVariant: ["tabular-nums"] }}>
        {display}
      </Text>
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

export function DateField({
  label,
  hint,
  value,
  onChange,
  minimumDate,
  maximumDate,
}: {
  label: string;
  hint?: string;
  value: Date;
  onChange: (value: Date) => void;
  minimumDate?: Date;
  maximumDate?: Date;
}) {
  return (
    <FieldRow hint={hint} label={label}>
      <PickerValue
        display={formatPickerDate(value)}
        label={label}
        maximumDate={maximumDate}
        minimumDate={minimumDate}
        mode="date"
        value={value}
        onChange={onChange}
      />
    </FieldRow>
  );
}

/**
 * A clock time as minutes since midnight (e.g. 450 = 07:30). Uses a fixed
 * reference day so DST never shifts the stored value.
 */
export function TimeField({
  label,
  hint,
  minute,
  onChange,
}: {
  label: string;
  hint?: string;
  minute: number;
  onChange: (minute: number) => void;
}) {
  return (
    <FieldRow hint={hint} label={label}>
      <PickerValue
        display={formatMinuteOfDay(minute)}
        label={label}
        mode="time"
        value={minuteToReferenceDate(minute)}
        onChange={(date) => onChange(date.getHours() * 60 + date.getMinutes())}
      />
    </FieldRow>
  );
}

export function minuteToReferenceDate(minute: number) {
  return new Date(2026, 0, 15, Math.floor(minute / 60), minute % 60);
}
