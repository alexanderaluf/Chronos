import { Pressable, View } from "react-native";
import { useTranslation } from "react-i18next";

import { FilledIcon } from "../filled-icon";

/** Soft shift colors that read well on light and dark backgrounds. */
export const SHIFT_COLORS = [
  "#C7A2CF",
  "#A79BE0",
  "#93A9DE",
  "#8EC3E6",
  "#86D3C7",
  "#9FD38A",
  "#C6D98A",
  "#E2D58A",
  "#E6BE8C",
  "#E8A08E",
] as const;

export function ColorPicker({ value, onChange }: { value: string; onChange: (color: string) => void }) {
  const { t } = useTranslation();
  return (
    <View className="flex-row flex-wrap justify-between gap-y-3 px-4 py-3">
      {SHIFT_COLORS.map((color) => {
        const selected = color.toLowerCase() === value.toLowerCase();
        return (
          <Pressable
            key={color}
            accessibilityLabel={t("common.color", { color })}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            className="size-9 items-center justify-center rounded-full"
            style={{ backgroundColor: color }}
            onPress={() => onChange(color)}
          >
            {selected ? <FilledIcon color="#1d2a22" name="check" size={20} /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}
