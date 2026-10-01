import { ActivityIndicator } from "react-native";

import { useAppThemeColors } from "@/shared/theme/app-theme";

/** iOS: the native activity indicator. Android has its own (`app-spinner.tsx`). */
export function AppSpinner() {
  const { accent } = useAppThemeColors();
  return <ActivityIndicator color={accent} />;
}
