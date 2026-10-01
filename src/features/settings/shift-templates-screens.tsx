import { router } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, View } from "react-native";

import { useDefaultJob, useShiftTemplate, useShiftTemplates } from "@/data/hooks/queries";
import {
  createShiftTemplate,
  deleteShiftTemplate,
  updateShiftTemplate,
} from "@/data/repositories/shift-templates-repository";
import type { Job, ShiftTemplate } from "@/domain/entities";
import { formatMinuteOfDay } from "@/domain/time/time";
import { Text } from "@/shared/ui/app-text";
import { ColorPicker, SHIFT_COLORS } from "@/shared/ui/form/color-picker";
import { TimeField } from "@/shared/ui/form/date-time-field";
import { AddRow, FormSection, SegmentedField, TextField } from "@/shared/ui/form/fields";
import { FormScreen } from "@/shared/ui/form/form-screen";
import { inputToMinor, inputToWholeNumber, minorToInput, required } from "@/shared/ui/form/input-format";
import { LoadingScreen, QueryGate } from "@/shared/ui/query-gate";
import { AppAlert } from "@/shared/ui/overlay/app-alert";
import { i18n } from "@/localization/i18n";

/** Route: /settings/templates */
export function ShiftTemplatesScreen() {
  const { t } = useTranslation();
  const templates = useShiftTemplates();
  const items = templates.data ?? [];
  return (
    <FormScreen
      intro={t("templates.intro")}
      title={t("templates.title")}
    >
      <FormSection>
        {items.length === 0 ? <Text className="px-4 py-3.5 text-sm text-muted">{t("templates.empty")}</Text> : null}
        {items.map((template) => (
          <Pressable
            key={template.id}
            accessibilityRole="button"
            className="flex-row items-center gap-3 border-b-2 border-background px-4 py-3.5 active:opacity-70"
            onPress={() => router.push(`/settings/templates/${template.id}`)}
          >
            <View className="size-3 rounded-full" style={{ backgroundColor: template.color }} />
            <Text className="flex-1 text-base">{template.name}</Text>
            <Text className="text-sm text-muted">
              {template.startMinute !== null && template.endMinute !== null
                ? `${formatMinuteOfDay(template.startMinute)}–${formatMinuteOfDay(template.endMinute)}`
                : t("templates.variableHours")}
            </Text>
          </Pressable>
        ))}
        <AddRow label={t("templates.add")} onPress={() => router.push("/settings/templates/new")} />
      </FormSection>
    </FormScreen>
  );
}

type HoursMode = "fixed" | "variable";

function ShiftTemplateForm({ job, existing }: { job: Job; existing?: ShiftTemplate }) {
  const { t } = useTranslation();
  const database = useSQLiteContext();
  const hoursModes: { value: HoursMode; label: string }[] = [
    { value: "fixed", label: t("templates.fixedHours") },
    { value: "variable", label: t("templates.variableHours") },
  ];
  const [name, setName] = useState(existing?.name ?? "");
  const [color, setColor] = useState(existing?.color ?? SHIFT_COLORS[2]);
  const [hoursMode, setHoursMode] = useState<HoursMode>(existing && existing.startMinute === null ? "variable" : "fixed");
  const [startMinute, setStartMinute] = useState(existing?.startMinute ?? 7 * 60);
  const [endMinute, setEndMinute] = useState(existing?.endMinute ?? 15 * 60);
  const [breakMinutes, setBreakMinutes] = useState(String(existing?.breakMinutes ?? 0));
  const [hourlyRate, setHourlyRate] = useState(existing?.hourlyRate != null ? minorToInput(existing.hourlyRate) : "");
  const [bonus, setBonus] = useState(minorToInput(existing?.bonus ?? 0));

  async function save() {
    const input = {
      jobId: existing?.jobId ?? job.id,
      name,
      color,
      startMinute: hoursMode === "fixed" ? startMinute : null,
      endMinute: hoursMode === "fixed" ? endMinute : null,
      breakMinutes: required(inputToWholeNumber(breakMinutes), t("templates.break")),
      hourlyRate: hourlyRate.trim() === "" ? null : required(inputToMinor(hourlyRate), t("templates.hourlyRate")),
      bonus: required(inputToMinor(bonus), t("templates.bonus")),
    };
    if (existing) await updateShiftTemplate(database, existing.id, input);
    else await createShiftTemplate(database, input);
  }

  function confirmDelete() {
    if (!existing) return;
    AppAlert.alert(t("templates.deleteTitle", { name: existing.name }), t("templates.deleteMessage"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("common.delete"),
        style: "destructive",
        onPress: async () => {
          await deleteShiftTemplate(database, existing.id);
          router.back();
        },
      },
    ]);
  }

  return (
    <FormScreen
      secondaryAction={existing ? { icon: "delete", label: t("templates.delete"), onPress: confirmDelete, tone: "danger" } : undefined}
      title={existing ? t("templates.editTitle") : t("templates.newTitle")}
      onSave={save}
    >
      <FormSection>
        <ColorPicker value={color} onChange={setColor} />
        <TextField label={t("templates.name")} placeholder={t("templates.namePlaceholder")} value={name} onChangeText={setName} />
      </FormSection>
      <FormSection title={t("templates.times")}>
        <SegmentedField options={hoursModes} value={hoursMode} onChange={setHoursMode} />
        {hoursMode === "fixed" ? (
          <>
            <TimeField label={t("templates.start")} minute={startMinute} onChange={setStartMinute} />
            <TimeField hint={endMinute <= startMinute ? t("templates.endsNextDay") : undefined} label={t("templates.end")} minute={endMinute} onChange={setEndMinute} />
          </>
        ) : null}
        <TextField keyboardType="number-pad" label={t("templates.break")} suffix={t("units.minutesSuffix")} value={breakMinutes} onChangeText={setBreakMinutes} />
      </FormSection>
      <FormSection footnote={t("templates.payNote")} title={t("templates.pay")}>
        <TextField keyboardType="decimal-pad" label={t("templates.hourlyRate")} placeholder={minorToInput(job.hourlyRate)} value={hourlyRate} onChangeText={setHourlyRate} />
      </FormSection>
      <FormSection title={t("templates.additions")}>
        <TextField hint={t("templates.bonusHint")} keyboardType="decimal-pad" label={t("templates.bonus")} value={bonus} onChangeText={setBonus} />
      </FormSection>
    </FormScreen>
  );
}

/** Route: /settings/templates/new */
export function NewShiftTemplateScreen() {
  const job = useDefaultJob();
  if (!job.data) return <LoadingScreen message={job.status === "ready" ? i18n.t("common.setUpSalaryFirst") : undefined} title={i18n.t("templates.newTitle")} />;
  return <ShiftTemplateForm job={job.data} />;
}

/** Route: /settings/templates/[id] */
export function EditShiftTemplateScreen({ id }: { id: string }) {
  const template = useShiftTemplate(id);
  const job = useDefaultJob();
  return (
    <QueryGate query={template} title={i18n.t("templates.editTitle")}>
      {(loaded) => (job.data ? <ShiftTemplateForm existing={loaded} job={job.data} /> : <LoadingScreen title={i18n.t("templates.editTitle")} />)}
    </QueryGate>
  );
}
