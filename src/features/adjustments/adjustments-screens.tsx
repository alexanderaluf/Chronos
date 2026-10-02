import { router } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, View } from "react-native";

import { useAdjustment, useAdjustments } from "@/data/hooks/queries";
import { createAdjustment, deleteAdjustment, updateAdjustment } from "@/data/repositories/adjustments-repository";
import type { AdjustmentKind, PayAdjustment } from "@/domain/entities";
import { parsePeriodKey } from "@/domain/time/time";
import { usePeriodNavigation } from "@/features/shifts/hooks/use-period-key";
import { usePrimaryCurrency } from "@/features/shifts/hooks/use-primary-currency";
import { formatMoney, formatMonthLabel } from "@/shared/lib/format";
import { Text } from "@/shared/ui/app-text";
import { AddRow, FormSection } from "@/shared/ui/form/fields";
import { InputCard, ToggleCard } from "@/shared/ui/form/cards";
import { FormScreen } from "@/shared/ui/form/form-screen";
import { GlassSegmentedControl } from "@/shared/ui/glass-segmented-control";
import { inputToMinor, minorToInput, required } from "@/shared/ui/form/input-format";
import { PeriodSwitcher } from "@/shared/ui/period-switcher";
import { QueryGate } from "@/shared/ui/query-gate";
import { AppAlert } from "@/shared/ui/overlay/app-alert";
import { i18n } from "@/localization/i18n";

function monthLabel(periodKey: string) {
  const { year, month } = parsePeriodKey(periodKey);
  return formatMonthLabel(new Date(year, month - 1, 1));
}

/** Route: /adjustments — one-off bonuses and deductions, per month. */
export function AdjustmentsScreen() {
  const { t } = useTranslation();
  const navigation = usePeriodNavigation();
  const adjustments = useAdjustments(navigation.periodKey);
  const currency = usePrimaryCurrency();
  const items = adjustments.data ?? [];

  const row = (item: PayAdjustment) => (
    <Pressable
      key={item.id}
      accessibilityRole="button"
      className="flex-row items-center justify-between border-b-2 border-background px-4 py-3.5 active:opacity-70"
      onPress={() => router.push(`/adjustments/${item.id}`)}
    >
      <View className="flex-1">
        <Text className="text-base">{item.label}</Text>
        {item.kind === "bonus" && !item.isTaxable ? <Text className="text-xs text-muted">{t("adjustments.notTaxable")}</Text> : null}
      </View>
      <Text className={item.kind === "bonus" ? "text-success" : "text-danger"}>
        {item.kind === "bonus" ? "+" : "−"}
        {formatMoney(item.amount, currency)}
      </Text>
    </Pressable>
  );

  return (
    <FormScreen
      intro={t("adjustments.intro")}
      title={t("adjustments.title")}
    >
      <PeriodSwitcher
        label={monthLabel(navigation.periodKey)}
        onNext={navigation.next}
        onPrevious={navigation.previous}
        onReset={navigation.reset}
      />
      <FormSection title={t("adjustments.bonuses")}>
        {items.filter((item) => item.kind === "bonus").map(row)}
        <AddRow label={t("adjustments.addBonus")} onPress={() => router.push({ pathname: "/adjustments/new", params: { period: navigation.periodKey, kind: "bonus" } })} />
      </FormSection>
      <FormSection title={t("adjustments.deductions")}>
        {items.filter((item) => item.kind === "deduction").map(row)}
        <AddRow label={t("adjustments.addDeduction")} onPress={() =>
            router.push({ pathname: "/adjustments/new", params: { period: navigation.periodKey, kind: "deduction" } })} />
      </FormSection>
    </FormScreen>
  );
}

function AdjustmentForm({ periodKey, initialKind, existing }: { periodKey: string; initialKind: AdjustmentKind; existing?: PayAdjustment }) {
  const { t } = useTranslation();
  const database = useSQLiteContext();
  const kinds: readonly { value: AdjustmentKind; label: string }[] = [
    { value: "bonus", label: t("adjustments.bonus") },
    { value: "deduction", label: t("adjustments.deduction") },
  ];
  const [kind, setKind] = useState<AdjustmentKind>(existing?.kind ?? initialKind);
  const [label, setLabel] = useState(existing?.label ?? "");
  const [amount, setAmount] = useState(existing ? minorToInput(existing.amount) : "");
  const [isTaxable, setIsTaxable] = useState(existing?.isTaxable ?? true);

  async function save() {
    const input = {
      jobId: existing?.jobId ?? null,
      periodKey: existing?.periodKey ?? periodKey,
      kind,
      label,
      amount: required(inputToMinor(amount), i18n.t("adjustments.amount")),
      isTaxable: kind === "bonus" ? isTaxable : false,
    };
    if (existing) await updateAdjustment(database, existing.id, input);
    else await createAdjustment(database, input);
  }

  function confirmDelete() {
    if (!existing) return;
    AppAlert.alert(t("adjustments.deleteTitle"), undefined, [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("common.delete"),
        style: "destructive",
        onPress: async () => {
          await deleteAdjustment(database, existing.id);
          router.back();
        },
      },
    ]);
  }

  return (
    <FormScreen
      secondaryAction={existing ? { icon: "delete", label: t("common.delete"), onPress: confirmDelete, tone: "danger" } : undefined}
      intro={t("adjustments.forMonth", { month: monthLabel(existing?.periodKey ?? periodKey) })}
      saveLabel={existing ? t("common.saveChanges") : kind === "bonus" ? t("adjustments.addBonus") : t("adjustments.addDeduction")}
      title={kind === "bonus" ? t("adjustments.bonus") : t("adjustments.deduction")}
      topControl={<GlassSegmentedControl accessibilityLabel={t("adjustments.type")} options={kinds} value={kind} onChange={setKind} />}
      onSave={save}
    >
      <InputCard
        label={t("adjustments.description")}
        placeholder={kind === "bonus" ? t("adjustments.bonusPlaceholder") : t("adjustments.deductionPlaceholder")}
        value={label}
        onChangeText={setLabel}
      />
      <InputCard keyboardType="decimal-pad" label={t("adjustments.amount")} value={amount} onChangeText={setAmount} />
      {kind === "bonus" ? (
        <ToggleCard
          description={t("adjustments.taxableHint")}
          icon="receipt"
          label={t("adjustments.taxable")}
          value={isTaxable}
          onValueChange={setIsTaxable}
        />
      ) : null}
    </FormScreen>
  );
}

/** Route: /adjustments/new?period=YYYY-MM&kind=bonus|deduction */
export function NewAdjustmentScreen({ period, kind }: { period: string; kind?: string }) {
  return <AdjustmentForm initialKind={kind === "deduction" ? "deduction" : "bonus"} periodKey={period} />;
}

/** Route: /adjustments/[id] */
export function EditAdjustmentScreen({ id }: { id: string }) {
  const adjustment = useAdjustment(id);
  return (
    <QueryGate query={adjustment} title={i18n.t("adjustments.editTitle")}>
      {(loaded) => <AdjustmentForm existing={loaded} initialKind={loaded.kind} periodKey={loaded.periodKey} />}
    </QueryGate>
  );
}
