import { router } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";

import { useDefaultJob, usePaidDay } from "@/data/hooks/queries";
import { createPaidDay, deletePaidDay, updatePaidDay } from "@/data/repositories/paid-days-repository";
import type { Job, PaidDay, PaidDayKind } from "@/domain/entities";
import { fromLocalDateKey, startOfLocalDay, toLocalDateKey } from "@/domain/time/time";
import { Text } from "@/shared/ui/app-text";
import { CardRow, InputCard, PickerCard } from "@/shared/ui/form/cards";
import { formatPickerDate } from "@/shared/ui/form/date-time-field";
import { HelperText } from "@/shared/ui/form/fields";
import { GlassSegmentedControl } from "@/shared/ui/glass-segmented-control";
import { FormScreen } from "@/shared/ui/form/form-screen";
import {
  basisPointsToInput,
  hoursInputToMinutes,
  inputToBasisPoints,
  minutesToHoursInput,
  required,
} from "@/shared/ui/form/input-format";
import { LoadingScreen, QueryGate } from "@/shared/ui/query-gate";
import { AppAlert } from "@/shared/ui/overlay/app-alert";
import { i18n } from "@/localization/i18n";


function PaidDayForm({ job, existing, initialDate }: { job: Job; existing?: PaidDay; initialDate?: string }) {
  const { t } = useTranslation();
  const database = useSQLiteContext();
  const kinds = [
    { value: "vacation", label: t("paidDay.kinds.vacation") },
    { value: "sick", label: t("paidDay.kinds.sick") },
    { value: "holiday", label: t("paidDay.kinds.holiday") },
    { value: "other", label: t("paidDay.kinds.other") },
  ] as const;
  const [kind, setKind] = useState<PaidDayKind>(existing?.kind ?? "vacation");
  const [day, setDay] = useState(() =>
    existing ? fromLocalDateKey(existing.date) : initialDate ? fromLocalDateKey(initialDate) : startOfLocalDay(new Date()),
  );
  const [hours, setHours] = useState(minutesToHoursInput(existing?.minutes ?? job.payRules.dailyOvertimeThresholdMinutes));
  const [percent, setPercent] = useState(basisPointsToInput(existing?.rateBp ?? 10_000));
  const [note, setNote] = useState(existing?.note ?? "");

  async function save() {
    const input = {
      jobId: existing?.jobId ?? job.id,
      date: toLocalDateKey(day),
      kind,
      minutes: required(hoursInputToMinutes(hours), i18n.t("paidDay.hours")),
      rateBp: required(inputToBasisPoints(percent), i18n.t("paidDay.percent")),
      note,
    };
    if (existing) await updatePaidDay(database, existing.id, input);
    else await createPaidDay(database, input);
  }

  function confirmDelete() {
    if (!existing) return;
    AppAlert.alert(t("paidDay.deleteTitle"), undefined, [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("common.delete"),
        style: "destructive",
        onPress: async () => {
          await deletePaidDay(database, existing.id);
          router.back();
        },
      },
    ]);
  }

  return (
    <FormScreen
      secondaryAction={existing ? { icon: "delete", label: t("paidDay.deleteDay"), onPress: confirmDelete, tone: "danger" } : undefined}
      intro={
        job.payType === "monthly"
          ? t("paidDay.introMonthly")
          : t("paidDay.introHourly")
      }
      saveLabel={existing ? t("common.saveChanges") : t("paidDay.add")}
      title={existing ? t("paidDay.editTitle") : t("paidDay.newTitle")}
      topControl={
        <GlassSegmentedControl
          accessibilityLabel={t("paidDay.kindLabel")}
          options={kinds}
          value={kind}
          onChange={(value: PaidDayKind) => {
            setKind(value);
            if (!existing) setPercent(value === "sick" ? "50" : "100");
          }}
        />
      }
      onSave={save}
    >
      <PickerCard display={formatPickerDate(day)} label={t("paidDay.date")} mode="date" value={day} onChange={(date) => setDay(startOfLocalDay(date))} />
      <CardRow>
        <View className="flex-1">
          <InputCard
            keyboardType="decimal-pad"
            label={t("paidDay.hours")}
            trailing={<Text className="font-sans text-base text-muted">{t("units.hoursSuffix")}</Text>}
            value={hours}
            onChangeText={setHours}
          />
        </View>
        <View className="flex-1">
          <InputCard
            keyboardType="decimal-pad"
            label={t("paidDay.percent")}
            trailing={<Text className="font-sans text-base text-muted">%</Text>}
            value={percent}
            onChangeText={setPercent}
          />
        </View>
      </CardRow>
      {kind === "sick" ? <HelperText>{t("paidDay.sickHint")}</HelperText> : null}
      <InputCard label={t("paidDay.notes")} multiline placeholder={t("common.optional")} value={note} onChangeText={setNote} />
    </FormScreen>
  );
}

/** Route: /paid-days/new?date=YYYY-MM-DD */
export function NewPaidDayScreen({ date }: { date?: string }) {
  const job = useDefaultJob();
  if (!job.data) {
    return (
      <LoadingScreen
        message={job.status === "ready" ? i18n.t("common.setUpSalaryFirst") : job.error?.message}
        title={i18n.t("paidDay.newTitle")}
      />
    );
  }
  return <PaidDayForm initialDate={date} job={job.data} />;
}

/** Route: /paid-days/[id] */
export function EditPaidDayScreen({ id }: { id: string }) {
  const paidDay = usePaidDay(id);
  const job = useDefaultJob();
  return (
    <QueryGate query={paidDay} title={i18n.t("paidDay.editTitle")}>
      {(loaded) => (job.data ? <PaidDayForm existing={loaded} job={job.data} /> : <LoadingScreen title={i18n.t("paidDay.editTitle")} />)}
    </QueryGate>
  );
}
