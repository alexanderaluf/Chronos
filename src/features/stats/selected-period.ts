import { useSyncExternalStore } from "react";

import type { PeriodKey } from "@/domain/time/time";

/**
 * The month the Stats tab is showing, so the tab bar's Share button shares
 * that month. Module state is enough: it is UI state, never persisted.
 */
let selected: PeriodKey | null = null;
const listeners = new Set<() => void>();

export function setSelectedStatsPeriod(periodKey: PeriodKey) {
  if (selected === periodKey) return;
  selected = periodKey;
  listeners.forEach((listener) => listener());
}

export function getSelectedStatsPeriod(): PeriodKey | null {
  return selected;
}

export function useSelectedStatsPeriod(): PeriodKey | null {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => selected,
  );
}
