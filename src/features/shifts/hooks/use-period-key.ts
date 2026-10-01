import { useState } from "react";

import { useSettings } from "@/data/hooks/queries";
import { getPayPeriodForDate, parsePeriodKey, shiftPeriodKey, type PeriodKey } from "@/domain/time/time";

/** The pay period containing today, respecting the user's period start day. */
export function useCurrentPeriodKey(): PeriodKey {
  const settings = useSettings();
  return getPayPeriodForDate(new Date(), settings.data?.payPeriodStartDay ?? 1).key;
}

/** A browsable period: starts at the current one, moves with previous / next. */
export function usePeriodNavigation() {
  const current = useCurrentPeriodKey();
  const [offset, setOffset] = useState(0);
  const periodKey = shiftPeriodKey(current, offset);

  return {
    periodKey,
    isCurrent: offset === 0,
    previous: () => setOffset((value) => value - 1),
    next: () => setOffset((value) => value + 1),
    reset: () => setOffset(0),
    goTo: (target: PeriodKey) => {
      const from = parsePeriodKey(current);
      const to = parsePeriodKey(target);
      setOffset((to.year - from.year) * 12 + (to.month - from.month));
    },
  };
}
