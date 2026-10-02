import { router } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { usePayComponent, usePayComponents } from "@/data/hooks/queries";
import {
  createPayComponent,
  deletePayComponent,
  updatePayComponent,
} from "@/data/repositories/pay-components-repository";
import type { PayComponent, PayComponentCalculation, PayComponentKind } from "@/domain/entities";
import { i18n } from "@/localization/i18n";
import { describePayComponent } from "@/localization/labels";
import { usePrimaryCurrency } from "@/features/shifts/hooks/use-primary-currency";
import { formatNumber, formatStatementMoney } from "@/shared/lib/format";
import { useAppLocalization } from "@/localization/localization-provider";
import { Text } from "@/shared/ui/app-text";
import { AddRow, LinkRow, FormSection, SegmentedField, SwitchField, TextField } from "@/shared/ui/form/fields";
import { FormScreen } from "@/shared/ui/form/form-screen";
import {
  basisPointsToInput,
  inputToBasisPoints,
  inputToMinor,
  minorToInput,
  required,
} from "@/shared/ui/form/input-format";
import { QueryGate } from "@/shared/ui/query-gate";
import { AppAlert } from "@/shared/ui/overlay/app-alert";

/** Route: /settings/additions and /settings/deductions */
export function PayComponentsScreen({ kind }: { kind: PayComponentKind }) {
  const { t } = useTranslation();
  const { language } = useAppLocalization();
  const components = usePayComponents(kind);
  const currency = usePrimaryCurrency();
  const items = components.data ?? [];

  return (
    <FormScreen intro={t(`components.${kind}.intro`)} title={t(`components.${kind}.title`)}>
      <FormSection>
        {items.length === 0 ? <Text className="px-4 py-3.5 text-sm text-muted">{t(`components.${kind}.empty`)}</Text> : null}
        {items.map((item) => (
          <LinkRow
            key={item.id}
            label={item.name}
            hint={item.isActive ? undefined : t("components.paused")}
            value={describePayComponent(item, (amount) => formatStatementMoney(amount, currency, language), (percent) => formatNumber(percent, { maximumFractionDigits: 2 }, language))}
            onPress={() => router.push(`/settings/components/${item.id}`)}
          />
        ))}
        <AddRow label={t(`components.${kind}.add`)} onPress={() => router.push({ pathname: "/settings/components/new", params: { kind } })} />
      </FormSection>
    </FormScreen>
  );
}

function PayComponentForm({ kind, existing }: { kind: PayComponentKind; existing?: PayComponent }) {
  const { t } = useTranslation();
  const database = useSQLiteContext();
  const currency = usePrimaryCurrency();
  const calculations: { value: PayComponentCalculation; label: string }[] = [
    { value: "monthlyFixed", label: t("components.calculations.monthlyFixed") },
    { value: "perWorkDay", label: t("components.calculations.perWorkDay") },
    { value: "perWorkHour", label: t("components.calculations.perWorkHour") },
    { value: "percentOfGross", label: t("components.calculations.percentOfGross") },
  ];
  const [name, setName] = useState(existing?.name ?? "");
  const [calculation, setCalculation] = useState<PayComponentCalculation>(
    existing?.calculation ?? (kind === "deduction" ? "percentOfGross" : "perWorkDay"),
  );
  const [amount, setAmount] = useState(existing ? minorToInput(existing.amount) : "");
  const [percent, setPercent] = useState(existing ? basisPointsToInput(existing.rateBp) : "");
  const [isTaxable, setIsTaxable] = useState(existing?.isTaxable ?? true);
  const [isActive, setIsActive] = useState(existing?.isActive ?? true);
  const isPercent = calculation === "percentOfGross";

  async function save() {
    const input = {
      kind,
      name,
      calculation,
      amount: isPercent ? 0 : required(inputToMinor(amount), t("adjustments.amount")),
      rateBp: isPercent ? required(inputToBasisPoints(percent), t("components.percentage")) : 0,
      isTaxable: kind === "addition" ? isTaxable : false,
      isActive,
    };
    if (existing) await updatePayComponent(database, existing.id, input);
    else await createPayComponent(database, input);
  }

  function confirmDelete() {
    if (!existing) return;
    AppAlert.alert(t("components.deleteTitle", { name: existing.name }), t("components.deleteMessage"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("common.delete"),
        style: "destructive",
        onPress: async () => {
          await deletePayComponent(database, existing.id);
          router.back();
        },
      },
    ]);
  }

  const amountLabel = calculation === "percentOfGross" ? "" : t(`components.amountLabels.${calculation}`);

  return (
    <FormScreen
      secondaryAction={existing ? { icon: "delete", label: t("common.delete"), onPress: confirmDelete, tone: "danger" } : undefined}
      title={t(`components.${kind}.editTitle`)}
      onSave={save}
    >
      <FormSection>
        <TextField label={t("components.name")} placeholder={t(`components.${kind}.example`)} value={name} onChangeText={setName} />
        <SegmentedField label={t("components.calculated")} options={calculations} value={calculation} onChange={setCalculation} />
        {isPercent ? (
          <TextField
            hint={kind === "deduction" ? t("components.ofGross") : t("components.ofBase")}
            keyboardType="decimal-pad"
            label={t("components.percentage")}
            suffix="%"
            value={percent}
            onChangeText={setPercent}
          />
        ) : (
          <TextField currencyCode={currency} keyboardType="decimal-pad" label={amountLabel} value={amount} onChangeText={setAmount} />
        )}
        {kind === "addition" ? (
          <SwitchField hint={t("components.taxableHint")} label={t("components.taxable")} value={isTaxable} onValueChange={setIsTaxable} />
        ) : null}
        <SwitchField hint={t("components.activeHint")} label={t("components.active")} value={isActive} onValueChange={setIsActive} />
      </FormSection>
    </FormScreen>
  );
}

/** Route: /settings/components/new?kind=addition|deduction */
export function NewPayComponentScreen({ kind }: { kind: PayComponentKind }) {
  return <PayComponentForm kind={kind} />;
}

/** Route: /settings/components/[id] */
export function EditPayComponentScreen({ id }: { id: string }) {
  const component = usePayComponent(id);
  return (
    <QueryGate query={component} title={i18n.t("components.itemTitle")}>
      {(loaded) => <PayComponentForm existing={loaded} kind={loaded.kind} />}
    </QueryGate>
  );
}
