import { useTranslation } from "react-i18next";

import type { Job } from "@/domain/entities";
import { useAppLocalization } from "@/localization/localization-provider";
import { formatStatementMoney } from "@/shared/lib/format";

/** "₪45.00/h" or "₪12,000.00/mo": how a job pays, for profile rows. */
export function usePayLabel() {
  const { t } = useTranslation();
  const { language } = useAppLocalization();
  return (job: Job) =>
    job.payType === "hourly"
      ? t("units.perHour", { amount: formatStatementMoney(job.hourlyRate, job.currencyCode, language) })
      : t("units.perMonth", { amount: formatStatementMoney(job.monthlySalary, job.currencyCode, language) });
}
