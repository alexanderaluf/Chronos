import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { useSQLiteContext } from "expo-sqlite";

import { loadPeriodReport } from "@/data/reports/period-report";
import { getSettings } from "@/data/repositories/settings-repository";
import { getPayPeriodForDate } from "@/domain/time/time";
import { usePrimaryCurrency } from "@/features/shifts/hooks/use-primary-currency";
import { getSelectedStatsPeriod } from "@/features/stats/selected-period";
import { shareMonthlyReport } from "@/features/stats/share-report";
import type { TabActions } from "@/shared/navigation/tab-shell";
import { errorMessage } from "@/localization/errors";
import { AppAlert } from "@/shared/ui/overlay/app-alert";

/**
 * What the round button beside the tab bar does on each tab:
 * - Home: open the "Add" menu (shift, fixed shift, paid day, monthly additions)
 * - Calendar: add a shift
 * - Stats: share the shown month's report (email, WhatsApp…)
 * - Settings: open the quick salary calculator
 */
export function useTabActions({ openCreateMenu }: { openCreateMenu: () => void }): TabActions {
  const { t } = useTranslation();
  const database = useSQLiteContext();
  const currency = usePrimaryCurrency();

  async function shareReport() {
    try {
      const settings = await getSettings(database);
      const periodKey = getSelectedStatsPeriod() ?? getPayPeriodForDate(new Date(), settings.payPeriodStartDay).key;
      const summary = await loadPeriodReport(database, periodKey);
      await shareMonthlyReport(summary, currency, settings.employer);
    } catch (error) {
      AppAlert.alert(t("tabActions.shareFailed"), errorMessage(error));
    }
  }

  return {
    home: { icon: "add", label: t("tabActions.add"), onPress: openCreateMenu },
    calendar: { icon: "calendar-add", label: t("tabActions.addShift"), onPress: () => router.push("/shifts/new") },
    stats: { icon: "share", label: t("tabActions.shareReport"), onPress: () => void shareReport() },
    settings: { icon: "calculate", label: t("tabActions.calculator"), onPress: () => router.push("/tools/calculator") },
  };
}
