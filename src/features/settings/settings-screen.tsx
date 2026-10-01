import { router, type Href } from "expo-router";
import { useTranslation } from "react-i18next";

import { useDefaultJob, usePayComponents, useSettings, useShiftTemplates } from "@/data/hooks/queries";
import { formatMoney } from "@/shared/lib/format";
import { Text } from "@/shared/ui/app-text";
import type { FilledIconName } from "@/shared/ui/filled-icon";
import { FormSection, LinkRow } from "@/shared/ui/form/fields";
import { TabPage } from "@/shared/ui/tab-page";

type MenuItem = { icon: FilledIconName; color: string; label: string; href: Href; value?: string; hint?: string };

/** The Settings tab: every setup screen, grouped like a payslip. */
export function SettingsScreen() {
  const { t } = useTranslation();
  const job = useDefaultJob();
  const settings = useSettings();
  const additions = usePayComponents("addition");
  const deductions = usePayComponents("deduction");
  const templates = useShiftTemplates();

  const salaryValue = job.data
    ? job.data.payType === "hourly"
      ? t("units.perHour", { amount: formatMoney(job.data.hourlyRate, job.data.currencyCode) })
      : t("units.perMonth", { amount: formatMoney(job.data.monthlySalary, job.data.currencyCode) })
    : undefined;
  const count = (items?: unknown[]) => (items && items.length > 0 ? String(items.length) : undefined);

  const groups: { title: string; items: MenuItem[] }[] = [
    {
      title: t("settingsMenu.groups.salary"),
      items: [
        { icon: "person", color: "#a8b6f3", label: t("settingsMenu.personal"), href: "/settings/personal", hint: t("settingsMenu.personalHint") },
        { icon: "payments", color: "#9bd59b", label: t("settingsMenu.salary"), href: "/settings/salary", value: salaryValue },
        { icon: "tune", color: "#f187ae", label: t("settingsMenu.rates"), href: "/settings/rates", hint: t("settingsMenu.ratesHint") },
        { icon: "trending-up", color: "#ffc975", label: t("settingsMenu.additions"), href: "/settings/additions", value: count(additions.data) },
        { icon: "trending-down", color: "#ff9c87", label: t("settingsMenu.deductions"), href: "/settings/deductions", value: count(deductions.data) },
        { icon: "receipt", color: "#79bced", label: t("settingsMenu.taxes"), href: "/settings/taxes" },
        { icon: "repeat", color: "#77c8bd", label: t("settingsMenu.templates"), href: "/settings/templates", value: count(templates.data) },
        { icon: "work", color: "#ca79da", label: t("settingsMenu.employer"), href: "/settings/employer", value: settings.data?.employer.name || undefined },
      ],
    },
    {
      title: t("settingsMenu.groups.app"),
      items: [{ icon: "settings", color: "#929ce3", label: t("settingsMenu.general"), href: "/settings/general", hint: t("settingsMenu.generalHint") }],
    },
    {
      title: t("settingsMenu.groups.tools"),
      items: [
        { icon: "calculate", color: "#65c8d9", label: t("settingsMenu.calculator"), href: "/tools/calculator" },
        { icon: "week", color: "#dbe971", label: t("settingsMenu.schedule"), href: "/tools/weekly-schedule" },
        { icon: "info", color: "#74c8c5", label: t("settingsMenu.about"), href: "/about" },
      ],
    },
  ];

  return (
    <TabPage>
      <Text accessibilityRole="header" className="pt-3 font-manrope-bold text-2xl text-foreground">
        {t("settingsMenu.title")}
      </Text>
      {groups.map((group) => (
        <FormSection key={group.title} title={group.title}>
          {group.items.map((item) => (
            <LinkRow
              key={item.href as string}
              hint={item.hint}
              icon={item.icon}
              iconBackground={item.color}
              label={item.label}
              value={item.value}
              onPress={() => router.push(item.href)}
            />
          ))}
        </FormSection>
      ))}
      <Text className="px-1 font-sans text-xs text-muted">{t("common.localOnly")}</Text>
    </TabPage>
  );
}
