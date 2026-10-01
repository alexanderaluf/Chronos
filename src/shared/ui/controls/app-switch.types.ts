/** iOS: native SwiftUI toggle (`app-switch.ios.tsx`). Android: custom (`app-switch.tsx`). */
export type AppSwitchProps = {
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
  accessibilityLabel?: string;
};
