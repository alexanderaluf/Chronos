import { DateTimePicker } from "@expo/ui/community/datetime-picker";

import { useAppThemeColors } from "@/shared/theme/app-theme";

import type { DateTimePickerOverlayProps } from "./date-time-picker-overlay.types";

/**
 * Android: the native Material date / time dialog (@expo/ui drop-in).
 * Date and time pickers are the ONLY native UI Android uses (see AGENTS.md).
 * The dialog opens on mount, so it is rendered only while presented.
 */
export function DateTimePickerOverlay({
  isPresented,
  mode,
  value,
  minimumDate,
  maximumDate,
  onChange,
  onDismiss,
}: DateTimePickerOverlayProps) {
  const { accent } = useAppThemeColors();
  if (!isPresented) return null;

  return (
    <DateTimePicker
      accentColor={accent}
      is24Hour
      maximumDate={maximumDate}
      minimumDate={minimumDate}
      mode={mode}
      presentation="dialog"
      value={value}
      onDismiss={onDismiss}
      onValueChange={(_, date) => {
        onChange(date);
        onDismiss();
      }}
    />
  );
}
