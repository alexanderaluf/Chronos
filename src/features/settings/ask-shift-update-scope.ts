import type { ShiftUpdateScope } from "@/data/repositories/shifts-repository";
import { i18n } from "@/localization/i18n";
import { AppAlert } from "@/shared/ui/overlay/app-alert";

/**
 * Asked after Save on Salary settings and Holiday pay, when a value that
 * shifts keep their own copy of has changed. Resolves `null` on Cancel.
 */
export function askShiftUpdateScope(): Promise<ShiftUpdateScope | null> {
  return AppAlert.ask<ShiftUpdateScope>(
    i18n.t("shiftUpdateScope.title"),
    i18n.t("shiftUpdateScope.message"),
    [
      { text: i18n.t("shiftUpdateScope.currentPeriod"), value: "currentPeriod" },
      { text: i18n.t("shiftUpdateScope.newShiftsOnly"), value: "newShiftsOnly" },
    ],
    i18n.t("common.cancel"),
  );
}
