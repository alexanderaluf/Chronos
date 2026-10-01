import type { ReactNode } from "react";

/**
 * One API, two implementations (see AGENTS.md → Platform UI policy):
 * - `app-bottom-sheet.ios.tsx`: native SwiftUI sheet (Liquid Glass on iOS 26).
 * - `app-bottom-sheet.tsx`: custom sheet for Android (no native sheet/modal).
 */
export type AppBottomSheetProps = {
  isOpen: boolean;
  /** The user asked to close (drag down, backdrop, back button). Set `isOpen` to false. */
  onClose: () => void;
  /** Runs after the close animation finished — e.g. navigate somewhere now. */
  onDismissed?: () => void;
  children: ReactNode;
};
