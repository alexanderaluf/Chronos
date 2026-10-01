import { useSQLiteContext } from "expo-sqlite";

import { useDefaultJob, useOpenShift, useSettings } from "@/data/hooks/queries";
import { clockIn, clockOut } from "@/data/repositories/shifts-repository";
import { roundToStep } from "@/domain/time/time";
import { getDeviceTimeZone } from "@/shared/lib/format";
import { errorMessage } from "@/localization/errors";
import { i18n } from "@/localization/i18n";
import { AppAlert } from "@/shared/ui/overlay/app-alert";

/** Start / stop the running shift for the default job, honoring time rounding. */
export function useClockInOut() {
  const database = useSQLiteContext();
  const openShift = useOpenShift();
  const settings = useSettings();
  const job = useDefaultJob();

  async function toggle() {
    const step = settings.data?.roundingMinutes ?? 0;
    const now = step > 1 ? roundToStep(new Date(), step) : new Date();
    try {
      if (openShift.data) {
        await clockOut(database, now);
        return;
      }
      if (!job.data) {
        AppAlert.alert(i18n.t("home.setUpSalaryTitle"), i18n.t("home.setUpSalaryMessage"));
        return;
      }
      await clockIn(database, job.data.id, getDeviceTimeZone(), now);
    } catch (error) {
      AppAlert.alert(i18n.t("home.clockFailed"), errorMessage(error));
    }
  }

  return {
    openShift: openShift.data ?? null,
    isClockedIn: Boolean(openShift.data),
    isReady: openShift.status === "ready",
    toggle,
  };
}
