/**
 * The system date / time picker — native on BOTH platforms (the one exception
 * to "Android never uses native UI", see AGENTS.md):
 * - iOS (`.ios.tsx`): a SwiftUI popover anchored to the parent element (from Plutus).
 * - Android (`.tsx`): the Material date / time dialog via @expo/ui.
 *
 * Render it INSIDE the pressable that opens it: on iOS it anchors to that
 * element's frame (it fills the parent with `position: absolute`).
 */
export type DateTimePickerOverlayProps = {
  isPresented: boolean;
  mode: "date" | "time";
  value: Date;
  title: string;
  minimumDate?: Date;
  maximumDate?: Date;
  onChange: (value: Date) => void;
  onDismiss: () => void;
};
