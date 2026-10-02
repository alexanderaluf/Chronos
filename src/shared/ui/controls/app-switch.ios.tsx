import { Host, Switch } from "@expo/ui";
import { useAppLocalization } from "@/localization/localization-provider";

import { useAppThemeColors } from "@/shared/theme/app-theme";

import type { AppSwitchProps } from "./app-switch.types";

/** iOS: the native SwiftUI toggle via @expo/ui. */
export function AppSwitch({ value, onValueChange, disabled }: AppSwitchProps) {
  const { accent } = useAppThemeColors();
  const { isRTL } = useAppLocalization();
  return (
    <Host matchContents seedColor={accent} layoutDirection={isRTL ? "rightToLeft" : "leftToRight"}>
      <Switch disabled={disabled} value={value} onValueChange={onValueChange} />
    </Host>
  );
}
