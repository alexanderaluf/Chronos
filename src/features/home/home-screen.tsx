import { useTranslation } from "react-i18next";

import { usePeriodReport } from "@/data/hooks/queries";
import { ShiftRow } from "@/features/shifts/components/shift-row";
import { useClockInOut } from "@/features/shifts/hooks/use-clock-in-out";
import { useCurrentPeriodKey } from "@/features/shifts/hooks/use-period-key";
import { usePrimaryCurrency } from "@/features/shifts/hooks/use-primary-currency";
import { Text } from "@/shared/ui/app-text";
import { Panel, QueryState, Section } from "@/shared/ui/section";
import { TabPage } from "@/shared/ui/tab-page";

import { ActiveShiftCard } from "./components/active-shift-card";
import { HomeHeader } from "./components/home-header";
import { NextPlannedShiftCard } from "./components/next-planned-shift-card";
import { PeriodOverviewCard } from "./components/period-overview-card";

export function HomeScreen() {
  const { t } = useTranslation();
  const clock = useClockInOut();
  const periodKey = useCurrentPeriodKey();
  const report = usePeriodReport(periodKey);
  const currency = usePrimaryCurrency();
  const recent = report.data?.shifts.slice(-5).reverse() ?? [];

  return (
    <TabPage>
      <HomeHeader />
      <ActiveShiftCard openShift={clock.openShift} onToggle={clock.toggle} />
      <NextPlannedShiftCard />
      <Section title={t("home.thisMonth")}>
        {report.data ? <PeriodOverviewCard currency={currency} summary={report.data} /> : <QueryState error={report.error} />}
      </Section>
      <Section title={t("home.recentShifts")}>
        <Panel className="py-2">
          {recent.length > 0 ? (
            recent.map((item) => <ShiftRow key={item.shift.id} item={item} />)
          ) : (
            <Text className="py-3 text-sm text-muted">{t("home.noShifts")}</Text>
          )}
        </Panel>
      </Section>
    </TabPage>
  );
}
