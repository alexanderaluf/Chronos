import { Alert, Keyboard, Platform, type AlertButton } from "react-native";

/**
 * Use `AppAlert.alert` everywhere instead of React Native's `Alert.alert`.
 * Same call shape. iOS shows the native alert; Android shows the app's own
 * dialog (`AppAlertHost`), because Android never uses native dialogs.
 * The keyboard closes first, so it never covers the dialog.
 */
export type AlertRequest = {
  title: string;
  message?: string;
  buttons?: AlertButton[];
};

const queue: AlertRequest[] = [];
let wakeHost: (() => void) | null = null;

export const AppAlert = {
  alert(title: string, message?: string, buttons?: AlertButton[]) {
    Keyboard.dismiss();
    if (Platform.OS === "ios") {
      Alert.alert(title, message, buttons);
      return;
    }
    queue.push({ title, message, buttons });
    wakeHost?.();
  },

  /**
   * Asks a question with one button per option plus Cancel. Resolves with the
   * chosen option's value, or `null` when cancelled (Android back / backdrop too).
   */
  ask<T>(title: string, message: string, options: { text: string; value: T }[], cancelText: string): Promise<T | null> {
    return new Promise((resolve) => {
      AppAlert.alert(title, message, [
        ...options.map((option) => ({ text: option.text, onPress: () => resolve(option.value) })),
        { text: cancelText, style: "cancel", onPress: () => resolve(null) },
      ]);
    });
  },
};

/** For `AppAlertHost` only: take the next queued request. */
export function takeNextAlert(): AlertRequest | null {
  return queue.shift() ?? null;
}

/** For `AppAlertHost` only: get notified when a request is queued. */
export function setAlertHostWaker(wake: (() => void) | null) {
  wakeHost = wake;
}
