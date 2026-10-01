import { router } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";

import { useDefaultJob, useJob, useSettings, useShift, useShiftTemplate, useShiftTemplates } from "@/data/hooks/queries";
import { createShift, deleteShift, updateShift } from "@/data/repositories/shifts-repository";
import type { AppSettings, Job, Shift, ShiftTemplate } from "@/domain/entities";
import { calculatePayForShift } from "@/domain/pay/period-summary";
import {
  formatMinuteOfDay,
  fromIso,
  fromLocalDateKey,
  minuteOfDay,
  shiftRangeFromClockTimes,
  startOfLocalDay,
  type LocalDateKey,
} from "@/domain/time/time";
import { formatHours, formatMoney, getDeviceTimeZone } from "@/shared/lib/format";
import { Text } from "@/shared/ui/app-text";
import { FilledIcon } from "@/shared/ui/filled-icon";
import { CardAction, CardRow, InputCard, PickerCard, ToggleCard } from "@/shared/ui/form/cards";
import { ColorPicker } from "@/shared/ui/form/color-picker";
import { formatPickerDate, minuteToReferenceDate } from "@/shared/ui/form/date-time-field";
import { FormScreen } from "@/shared/ui/form/form-screen";
import { inputToMinor, inputToWholeNumber, minorToInput, required } from "@/shared/ui/form/input-format";
import { SelectionSection } from "@/shared/ui/form/selection-section";
import { GlassSegmentedControl } from "@/shared/ui/glass-segmented-control";
import { AppAlert } from "@/shared/ui/overlay/app-alert";
import { i18n } from "@/localization/i18n";
import { LoadingScreen, QueryGate } from "@/shared/ui/query-gate";

type FormValues = {
  day: Date;
  startMinute: number;
  endMinute: number;
  isRunning: boolean;
  breakMinutes: string;
  /** null = use the global hourly rate from Salary settings. */
  customHourlyRate: string | null;
  /** null = use the global bonus per shift from Salary settings. */
  customBonus: string | null;
  tips: string;
  isHoliday: boolean;
  color: string;
  label: string;
  note: string;
  templateId: string;
};

function roundMinute(minute: number, step: number) {
  return step > 1 ? (Math.round(minute / step) * step) % 1440 : minute;
}

function currencySymbol(code: string) {
  return code === "ILS" ? "₪" : code;
}

/**
 * Pay that comes from Salary settings unless overridden for this shift
 * (Plutus-style card with a "Custom" / "Global" switch).
 */
function GlobalValueCard({
  label,
  globalValue,
  custom,
  currency,
  onCustomChange,
}: {
  label: string;
  globalValue: number;
  custom: string | null;
  currency: string;
  onCustomChange: (value: string | null) => void;
}) {
  const { t } = useTranslation();
  if (custom === null) {
    return (
      <View className="min-h-20 flex-1 justify-center gap-1 rounded-2xl bg-surface px-4 py-2">
        <Text className="font-manrope-medium text-xs text-muted" numberOfLines={1}>
          {label}
        </Text>
        <Text className="font-manrope-semibold text-lg text-foreground">{formatMoney(globalValue, currency)}</Text>
        <View className="flex-row items-center justify-between gap-2">
          <Text className="font-sans text-xs text-muted">{t("common.global")}</Text>
          <CardAction label={t("common.custom")} onPress={() => onCustomChange(minorToInput(globalValue))} />
        </View>
      </View>
    );
  }
  return (
    <View className="flex-1">
      <InputCard
        keyboardType="decimal-pad"
        label={t("shift.thisShift", { label })}
        placeholder={currencySymbol(currency)}
        trailing={<CardAction label={t("common.global")} onPress={() => onCustomChange(null)} />}
        value={custom}
        onChangeText={(text) => onCustomChange(text)}
      />
    </View>
  );
}

/** The editable form. `existing` = edit mode; otherwise a new shift. */
function ShiftForm({
  initial,
  job,
  settings,
  existing,
}: {
  initial: FormValues;
  job: Job;
  settings: AppSettings;
  existing?: Shift;
}) {
  const { t } = useTranslation();
  const database = useSQLiteContext();
  const templates = useShiftTemplates();
  const dayTypes = [
    { value: "regular", label: t("shift.regularDay") },
    { value: "holiday", label: t("shift.holiday") },
  ] as const;
  const [values, setValues] = useState(initial);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const set = <K extends keyof FormValues>(key: K, value: FormValues[K]) =>
    setValues((current) => ({ ...current, [key]: value }));

  const endsNextDay = !values.isRunning && values.endMinute <= values.startMinute;
  const isHourly = job.payType === "hourly";

  function buildInput() {
    const step = settings.roundingMinutes;
    const range = shiftRangeFromClockTimes(values.day, roundMinute(values.startMinute, step), roundMinute(values.endMinute, step));
    return {
      jobId: existing?.jobId ?? job.id,
      startAt: range.start,
      endAt: values.isRunning ? null : range.end,
      breakMinutes: required(inputToWholeNumber(values.breakMinutes), i18n.t("shift.fields.break")),
      hourlyRate:
        values.customHourlyRate === null ? job.hourlyRate : required(inputToMinor(values.customHourlyRate), i18n.t("shift.fields.hourlyRate")),
      bonus: values.customBonus === null ? job.defaultShiftBonus : required(inputToMinor(values.customBonus), i18n.t("shift.fields.bonus")),
      tips: required(inputToMinor(values.tips), i18n.t("shift.fields.tips")),
      isHoliday: values.isHoliday,
      color: values.color,
      label: values.label,
      note: values.note,
    };
  }

  // Live estimate of what this shift pays (null while a field is invalid).
  let estimate: ReturnType<typeof calculatePayForShift> = null;
  try {
    const input = buildInput();
    if (input.endAt) {
      const now = new Date().toISOString();
      estimate = calculatePayForShift(
        {
          id: "draft",
          jobId: input.jobId,
          startAt: input.startAt.toISOString(),
          endAt: input.endAt.toISOString(),
          timeZone: getDeviceTimeZone(),
          breakMinutes: input.breakMinutes,
          hourlyRate: input.hourlyRate,
          isHoliday: input.isHoliday,
          bonus: input.bonus,
          tips: input.tips,
          note: null,
          color: null,
          label: null,
          createdAt: now,
          updatedAt: now,
          deletedAt: null,
        },
        job,
      );
    }
  } catch {
    estimate = null;
  }

  async function save() {
    const input = buildInput();
    if (existing) {
      await updateShift(database, existing.id, input);
      return;
    }
    const saved = await createShift(database, { ...input, timeZone: getDeviceTimeZone() });
    const pay = calculatePayForShift(saved, job);
    if (settings.showShiftSummaryAfterSave && pay) {
      AppAlert.alert(
        t("shift.savedTitle"),
        [
          t("shift.savedWorked", { hours: formatHours(pay.workedMinutes) }),
          pay.overtimeMinutes > 0 ? t("shift.savedOvertime", { hours: formatHours(pay.overtimeMinutes) }) : null,
          pay.isNightShift ? t("shift.savedNight") : null,
          pay.isRestDay ? t("shift.savedRestDay") : null,
          t("shift.savedPay", { amount: formatMoney(pay.total, job.currencyCode) }),
        ]
          .filter(Boolean)
          .join("\n"),
      );
    }
  }

  function applyTemplate(template: ShiftTemplate | undefined) {
    if (!template) {
      set("templateId", "");
      return;
    }
    setValues((current) => ({
      ...current,
      templateId: template.id,
      startMinute: template.startMinute ?? current.startMinute,
      endMinute: template.endMinute ?? current.endMinute,
      breakMinutes: String(template.breakMinutes),
      customHourlyRate: template.hourlyRate !== null ? minorToInput(template.hourlyRate) : null,
      customBonus: template.bonus > 0 ? minorToInput(template.bonus) : null,
      color: template.color,
      label: template.name,
    }));
  }

  function confirmDelete() {
    if (!existing) return;
    AppAlert.alert(t("shift.deleteTitle"), t("shift.deleteMessage"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("common.delete"),
        style: "destructive",
        onPress: async () => {
          await deleteShift(database, existing.id);
          router.back();
        },
      },
    ]);
  }

  const templateOptions = (templates.data ?? []).map((template) => ({
    id: template.id,
    name: template.name,
    color: template.color,
    detail:
      template.startMinute !== null && template.endMinute !== null
        ? `${formatMinuteOfDay(template.startMinute)}–${formatMinuteOfDay(template.endMinute)}`
        : undefined,
  }));

  return (
    <FormScreen
      saveLabel={existing ? t("common.saveChanges") : t("shift.addShift")}
      secondaryAction={existing ? { icon: "delete", label: t("shift.deleteShift"), onPress: confirmDelete, tone: "danger" } : undefined}
      title={existing ? t("shift.editTitle") : t("shift.newTitle")}
      topControl={
        <GlassSegmentedControl
          accessibilityLabel={t("shift.dayType")}
          options={dayTypes}
          value={values.isHoliday ? "holiday" : "regular"}
          onChange={(value) => set("isHoliday", value === "holiday")}
        />
      }
      onSave={save}
    >
      <InputCard
        icon="edit-note"
        label={t("shift.name")}
        placeholder={t("shift.namePlaceholder")}
        value={values.label}
        onChangeText={(text) => set("label", text)}
      />

      <PickerCard
        display={formatPickerDate(values.day)}
        label={t("shift.date")}
        mode="date"
        value={values.day}
        onChange={(date) => set("day", startOfLocalDay(date))}
      />

      <CardRow>
        <PickerCard
          display={formatMinuteOfDay(values.startMinute)}
          icon="play"
          label={t("shift.start")}
          mode="time"
          value={minuteToReferenceDate(values.startMinute)}
          onChange={(date) => set("startMinute", minuteOfDay(date))}
        />
        {values.isRunning ? (
          <View className="min-h-20 flex-1 justify-center rounded-2xl bg-accent/12 px-4">
            <Text className="font-manrope-semibold text-base text-accent">{t("shift.stillOnShift")}</Text>
          </View>
        ) : (
          <PickerCard
            display={formatMinuteOfDay(values.endMinute)}
            footnote={endsNextDay ? t("shift.nextDay") : undefined}
            icon="stop"
            label={t("shift.end")}
            mode="time"
            value={minuteToReferenceDate(values.endMinute)}
            onChange={(date) => set("endMinute", minuteOfDay(date))}
          />
        )}
      </CardRow>

      {existing && !existing.endAt ? (
        <ToggleCard
          description={t("shift.stillOnShiftHint")}
          icon="timer"
          label={t("shift.stillOnShift")}
          value={values.isRunning}
          onValueChange={(value) => set("isRunning", value)}
        />
      ) : null}

      <InputCard
        icon="clock"
        keyboardType="number-pad"
        label={job.payRules.unpaidBreaks ? t("shift.breakUnpaid") : t("shift.breakPaid")}
        trailing={<Text className="font-sans text-base text-muted">{t("units.minutesSuffix")}</Text>}
        value={values.breakMinutes}
        onChangeText={(text) => set("breakMinutes", text)}
      />

      <View className="gap-3">
        <Text className="px-1 font-manrope-bold text-lg text-foreground">{t("shift.pay")}</Text>
        <CardRow>
          {isHourly ? (
            <GlobalValueCard
              currency={job.currencyCode}
              custom={values.customHourlyRate}
              globalValue={job.hourlyRate}
              label={t("shift.hourlyRate")}
              onCustomChange={(value) => set("customHourlyRate", value)}
            />
          ) : null}
          <GlobalValueCard
            currency={job.currencyCode}
            custom={values.customBonus}
            globalValue={job.defaultShiftBonus}
            label={t("shift.bonus")}
            onCustomChange={(value) => set("customBonus", value)}
          />
        </CardRow>
        <InputCard
          icon="payments"
          keyboardType="decimal-pad"
          label={t("shift.tips")}
          trailing={<Text className="font-sans text-base text-muted">{currencySymbol(job.currencyCode)}</Text>}
          value={values.tips}
          onChangeText={(text) => set("tips", text)}
        />
        {estimate ? (
          <View className="flex-row items-center gap-3 rounded-2xl bg-surface-secondary p-4">
            <FilledIcon name="calculate" size={22} tone="accent" />
            <View className="min-w-0 flex-1">
              <Text className="font-manrope-semibold text-base text-foreground">
                {t("shift.estimated", { amount: formatMoney(estimate.total, job.currencyCode) })}
              </Text>
              <Text className="font-sans text-sm text-muted">
                {t("shift.worked", { hours: formatHours(estimate.workedMinutes) })}
                {estimate.overtimeMinutes > 0 ? t("shift.overtimeSuffix", { hours: formatHours(estimate.overtimeMinutes) }) : ""}
                {estimate.isNightShift ? t("shift.nightSuffix") : ""}
                {estimate.isRestDay ? t("shift.restDaySuffix") : ""}
              </Text>
            </View>
          </View>
        ) : null}
      </View>

      <SelectionSection
        addLabel={t("shift.newFixedShift")}
        expanded={templatesOpen}
        icon="repeat"
        optional
        options={templateOptions}
        placeholder={t("shift.fixedShiftPlaceholder")}
        selectedId={values.templateId}
        title={t("shift.fixedShift")}
        onAdd={() => router.push("/settings/templates/new")}
        onSelect={(id) => applyTemplate(templates.data?.find((template) => template.id === id))}
        onToggle={() => setTemplatesOpen((open) => !open)}
      />

      <View className="gap-3">
        <Text className="px-1 font-manrope-bold text-lg text-foreground">{t("shift.color")}</Text>
        <View className="rounded-2xl bg-surface py-1">
          <ColorPicker value={values.color} onChange={(color) => set("color", color)} />
        </View>
      </View>

      <InputCard
        icon="notes"
        label={t("shift.notes")}
        multiline
        placeholder={t("shift.notesPlaceholder")}
        value={values.note}
        onChangeText={(text) => set("note", text)}
      />
    </FormScreen>
  );
}

function valuesForNewShift(job: Job, date: LocalDateKey | undefined, template: ShiftTemplate | null): FormValues {
  return {
    day: date ? fromLocalDateKey(date) : startOfLocalDay(new Date()),
    startMinute: template?.startMinute ?? 8 * 60,
    endMinute: template?.endMinute ?? 16 * 60,
    isRunning: false,
    breakMinutes: String(template?.breakMinutes ?? 0),
    customHourlyRate: template?.hourlyRate != null ? minorToInput(template.hourlyRate) : null,
    customBonus: template && template.bonus > 0 ? minorToInput(template.bonus) : null,
    tips: "0",
    isHoliday: false,
    color: template?.color ?? job.color,
    label: template?.name ?? "",
    note: "",
    templateId: template?.id ?? "",
  };
}

function valuesForExistingShift(shift: Shift, job: Job): FormValues {
  const start = fromIso(shift.startAt);
  const end = shift.endAt ? fromIso(shift.endAt) : new Date();
  return {
    day: startOfLocalDay(start),
    startMinute: minuteOfDay(start),
    endMinute: minuteOfDay(end),
    isRunning: shift.endAt === null,
    breakMinutes: String(shift.breakMinutes),
    // A value equal to today's global setting is shown as "Global".
    customHourlyRate: shift.hourlyRate === job.hourlyRate ? null : minorToInput(shift.hourlyRate),
    customBonus: shift.bonus === job.defaultShiftBonus ? null : minorToInput(shift.bonus),
    tips: minorToInput(shift.tips),
    isHoliday: shift.isHoliday,
    color: shift.color ?? job.color,
    label: shift.label ?? "",
    note: shift.note ?? "",
    templateId: "",
  };
}

/** Route: /shifts/new?date=YYYY-MM-DD&templateId=… */
export function NewShiftScreen({ date, templateId }: { date?: string; templateId?: string }) {
  const job = useDefaultJob();
  const settings = useSettings();
  const template = useShiftTemplate(templateId ?? "");

  if (job.status === "ready" && !job.data) {
    return <LoadingScreen message={i18n.t("common.setUpSalaryFirst")} title={i18n.t("shift.newTitle")} />;
  }
  if (!job.data || !settings.data || (templateId && template.status === "loading")) {
    return <LoadingScreen message={job.error?.message ?? settings.error?.message} title={i18n.t("shift.newTitle")} />;
  }
  return <ShiftForm initial={valuesForNewShift(job.data, date, template.data ?? null)} job={job.data} settings={settings.data} />;
}

/** Route: /shifts/[id] */
export function EditShiftScreen({ id }: { id: string }) {
  const shift = useShift(id);
  const job = useJob(shift.data?.jobId ?? "");
  const settings = useSettings();

  return (
    <QueryGate query={shift} title={i18n.t("shift.editTitle")}>
      {(loaded) =>
        job.data && settings.data ? (
          <ShiftForm existing={loaded} initial={valuesForExistingShift(loaded, job.data)} job={job.data} settings={settings.data} />
        ) : (
          <LoadingScreen title={i18n.t("shift.editTitle")} />
        )
      }
    </QueryGate>
  );
}
