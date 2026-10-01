import { Alert, Platform, type AlertButton } from "react-native";

/**
 * Use `AppAlert.alert` everywhere instead of React Native's `Alert.alert`.
 * Same call shape. iOS shows the native alert; Android shows the app's own
 * dialog (`AppAlertHost`), because Android never uses native dialogs.
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
    if (Platform.OS === "ios") {
      Alert.alert(title, message, buttons);
      return;
    }
    queue.push({ title, message, buttons });
    wakeHost?.();
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
