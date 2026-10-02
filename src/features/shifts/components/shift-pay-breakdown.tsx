import { useTranslation } from "react-i18next";
import { View } from "react-native";

import type { SalaryAgreement } from "@/domain/pay/salary-agreement";
import type { ShiftPay } from "@/domain/pay/shift-pay";
import { formatHolidayTime, formatHours, formatPercent, formatStatementMoney } from "@/shared/lib/format";
import { Text } from "@/shared/ui/app-text";
import { FormSection } from "@/shared/ui/form/fields";
import { ValueRow } from "@/shared/ui/section";

export function ShiftPayBreakdown({ pay, agreement, currency, isHourly, hasUnpaidBreak }: {
  pay: ShiftPay;
  agreement: SalaryAgreement;
  currency: string;
  isHourly: boolean;
  hasUnpaidBreak: boolean;
}) {
  const { t } = useTranslation();
  const money = (amount: number) => formatStatementMoney(amount, currency);
  return (
    <FormSection title={t("shift.payBreakdown")} footnote={hasUnpaidBreak ? t("holidayPay.breakPolicy") : undefined}>
      {pay.segments.map((segment, index) => (
        <View key={index} className="gap-1 border-b-2 border-background px-4 py-3">
          <Text className="font-manrope-semibold text-base">
            {t(segment.holiday ? "holidayPay.holiday" : segment.restDay ? "shift.shabbatHours" : segment.kind === "regular" ? "shift.ordinaryHours" : segment.kind === "overtimeTier1" ? "rates.tier1Hours" : "shift.laterOvertime")}
            {(segment.holiday || segment.restDay) && segment.kind !== "regular" ? ` · ${t(segment.kind === "overtimeTier1" ? "rates.tier1Hours" : "shift.laterOvertime")}` : ""}
          </Text>
          {segment.startsAt && segment.endsAt ? <Text className="text-sm text-muted">
            {formatHolidayTime(new Date(segment.startsAt))} – {formatHolidayTime(new Date(segment.endsAt))}
          </Text> : null}
          <Text className="font-manrope-semibold text-base">
            {t("shift.hourlySum", { hours: formatHours(segment.minutes), hourly: money(segment.hourlyPay), total: money(segment.total) })}
          </Text>
          {isHourly ? <Text className="text-sm text-muted">
            {t("shift.baseRateDetail", { rate: formatPercent(segment.rateBp), amount: money(segment.hourlyBasePay) })}
          </Text> : null}
          {agreement.enabled ? <Text className="text-sm text-muted">
            {segment.agreementApplied
              ? t("shift.agreementRateDetail", { percent: formatPercent(agreement.rateBp), amount: money(segment.hourlyAgreementPay) })
              : t(isHourly ? "shift.agreementExcluded" : "shift.agreementIncludedInSalary")}
          </Text> : null}
        </View>
      ))}
      {pay.totalNightPremium > 0 ? <ValueRow className="border-b-2 border-background px-4 py-3" label={t("rates.nightPremium")} value={money(pay.totalNightPremium)} valueDirection="ltr" /> : null}
      {!isHourly ? <Text className="px-4 py-3 text-sm text-muted">{t("shift.monthlyBreakdownNote")}</Text> : null}
    </FormSection>
  );
}
