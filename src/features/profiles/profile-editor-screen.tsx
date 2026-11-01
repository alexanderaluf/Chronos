import { router } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";

import { useActiveJob, useJob, useProfiles, useSettings } from "@/data/hooks/queries";
import { createProfile, updateProfile } from "@/data/repositories/profiles-repository";
import type { AppSettings, Job } from "@/domain/entities";
import { WORK_CITIES, type WorkCity } from "@/domain/holidays/holiday-settings";
import type { PayType } from "@/domain/pay/shift-pay";
import type { EmploymentType } from "@/domain/tax/tax-status";
import { useAppLocalization } from "@/localization/localization-provider";
import { currencyStatementParts } from "@/shared/lib/currency-display";
import { getAppLocale } from "@/shared/lib/format";
import { Text } from "@/shared/ui/app-text";
import { InputCard } from "@/shared/ui/form/cards";
import { ColorPicker, SHIFT_COLORS } from "@/shared/ui/form/color-picker";
import { FormSection, LinkRow, SegmentedField, SwitchField } from "@/shared/ui/form/fields";
import { FormScreen } from "@/shared/ui/form/form-screen";
import { inputToMinor, inputToWholeNumber, required } from "@/shared/ui/form/input-format";
import { SelectionSection } from "@/shared/ui/form/selection-section";
import { GlassSegmentedControl } from "@/shared/ui/glass-segmented-control";
import { ProfileAvatar } from "@/shared/ui/profile-avatar";
import { LoadingScreen, QueryGate } from "@/shared/ui/query-gate";

import { confirmDeleteProfile } from "./delete-profile";

/** The avatar as it will look, above the name. */
function AvatarPreview({ name, color }: { name: string; color: string }) {
  return (
    <View className="items-center pt-2">
      <ProfileAvatar color={color} name={name.trim() || "?"} size={76} />
    </View>
  );
}

function NewProfileForm({ settings, currencyCode, profileCount }: { settings: AppSettings; currencyCode: string; profileCount: number }) {
  const { t } = useTranslation();
  const database = useSQLiteContext();
  const { language } = useAppLocalization();
  const [name, setName] = useState("");
  const [color, setColor] = useState<string>(SHIFT_COLORS[profileCount % SHIFT_COLORS.length]);
  const [payType, setPayType] = useState<PayType>("hourly");
  const [hourlyRate, setHourlyRate] = useState("");
  const [monthlySalary, setMonthlySalary] = useState("");
  const [divisor, setDivisor] = useState("182");
  const [travel, setTravel] = useState("");
  const [employmentType, setEmploymentType] = useState<EmploymentType>(settings.taxStatus.employmentType);
  const [isMainJob, setIsMainJob] = useState(false);
  // Most second jobs are in the same area, so the current city is the starting point.
  const [workCity, setWorkCity] = useState<WorkCity | null>(settings.holidayPay.workCity);
  const [citiesOpen, setCitiesOpen] = useState(!settings.holidayPay.workCity);
  const symbol = currencyStatementParts(0, currencyCode, getAppLocale(language)).symbol;
  const currency = <Text className="text-lg text-muted">{symbol}</Text>;

  async function save() {
    if (!workCity) throw new Error(t("onboarding.cityPlaceholder"));
    await createProfile(database, {
      name,
      color,
      payType,
      hourlyRate: payType === "hourly" ? required(inputToMinor(hourlyRate), t("onboarding.hourlyWage")) : 0,
      monthlySalary: payType === "monthly" ? required(inputToMinor(monthlySalary), t("onboarding.monthlySalary")) : 0,
      monthlyHoursDivisor: payType === "monthly" ? required(inputToWholeNumber(divisor), t("onboarding.monthlyHours")) : 182,
      currencyCode,
      travelPerDay: required(inputToMinor(travel), t("onboarding.travel")),
      travelName: t("onboarding.travelName"),
      pensionName: t("profiles.pensionName"),
      employmentType,
      workCity,
      isMainJob,
    });
  }

  return (
    <FormScreen intro={t("profiles.newIntro")} saveIcon="add" saveLabel={t("profiles.create")} title={t("profiles.newTitle")} onSave={save}>
      <AvatarPreview color={color} name={name} />
      <InputCard label={t("onboarding.jobName")} placeholder={t("onboarding.jobNamePlaceholder")} value={name} onChangeText={setName} />
      <FormSection title={t("profiles.color")}>
        <ColorPicker value={color} onChange={setColor} />
      </FormSection>
      <GlassSegmentedControl
        accessibilityLabel={t("onboarding.pay")}
        options={[
          { value: "hourly", label: t("onboarding.hourly") },
          { value: "monthly", label: t("onboarding.monthly") },
        ]}
        value={payType}
        onChange={setPayType}
      />
      {payType === "hourly" ? (
        <InputCard keyboardType="decimal-pad" label={t("onboarding.hourlyWage")} trailing={currency} value={hourlyRate} onChangeText={setHourlyRate} />
      ) : (
        <>
          <InputCard keyboardType="decimal-pad" label={t("onboarding.monthlySalary")} trailing={currency} value={monthlySalary} onChangeText={setMonthlySalary} />
          <InputCard keyboardType="number-pad" label={t("onboarding.monthlyHours")} value={divisor} onChangeText={setDivisor} />
        </>
      )}
      <InputCard
        keyboardType="decimal-pad"
        label={`${t("onboarding.travel")} ${t("common.optional")}`}
        trailing={currency}
        value={travel}
        onChangeText={setTravel}
      />
      <SelectionSection
        expanded={citiesOpen}
        icon="location"
        options={(Object.keys(WORK_CITIES) as WorkCity[]).map((id) => ({ id, name: t(`holidayPay.cities.${id}`) }))}
        placeholder={t("onboarding.cityPlaceholder")}
        selectedId={workCity ?? ""}
        title={t("onboarding.city")}
        onSelect={(id) => {
          setWorkCity(id ? (id as WorkCity) : null);
          if (id) setCitiesOpen(false);
        }}
        onToggle={() => setCitiesOpen(!citiesOpen)}
      />
      <FormSection>
        <SegmentedField
          label={t("onboarding.employment")}
          options={[
            { value: "employee", label: t("taxes.employee") },
            { value: "selfEmployed", label: t("taxes.selfEmployed") },
          ]}
          value={employmentType}
          onChange={setEmploymentType}
        />
        <SwitchField hint={t("profiles.mainJobHint")} label={t("profiles.mainJob")} value={isMainJob} onValueChange={setIsMainJob} />
      </FormSection>
    </FormScreen>
  );
}

function EditProfileForm({ job, isActive, canDelete }: { job: Job; isActive: boolean; canDelete: boolean }) {
  const { t } = useTranslation();
  const database = useSQLiteContext();
  const [name, setName] = useState(job.name);
  const [color, setColor] = useState(job.color);

  return (
    <FormScreen
      secondaryAction={
        canDelete
          ? {
              icon: "delete",
              label: t("profiles.delete", { name: job.name }),
              tone: "danger",
              onPress: () =>
                void confirmDeleteProfile(database, job).then((deleted) => {
                  if (deleted && router.canGoBack()) router.back();
                }),
            }
          : undefined
      }
      title={t("profiles.editTitle")}
      onSave={() => updateProfile(database, job.id, { name, color })}
    >
      <AvatarPreview color={color} name={name} />
      <InputCard label={t("onboarding.jobName")} placeholder={t("onboarding.jobNamePlaceholder")} value={name} onChangeText={setName} />
      <FormSection title={t("profiles.color")}>
        <ColorPicker value={color} onChange={setColor} />
      </FormSection>
      {isActive ? (
        <FormSection footnote={t("profiles.editHint")}>
          <LinkRow icon="payments" iconBackground="#9bd59b" label={t("profiles.salarySettings")} onPress={() => router.push("/settings/salary")} />
        </FormSection>
      ) : (
        <Text className="px-1 font-sans text-xs leading-4 text-muted">{t("profiles.editHint")}</Text>
      )}
    </FormScreen>
  );
}

/** Route: /profile/new — adds a job profile and switches to it. */
export function NewProfileScreen() {
  const { t } = useTranslation();
  const settings = useSettings();
  const job = useActiveJob();
  const profiles = useProfiles();
  if (!settings.data || !profiles.data || job.status === "loading") return <LoadingScreen title={t("profiles.newTitle")} />;
  return <NewProfileForm currencyCode={job.data?.currencyCode ?? "ILS"} profileCount={profiles.data.length} settings={settings.data} />;
}

/** Route: /profile/[id] — renames or recolors a job profile, or deletes it. */
export function EditProfileScreen({ id }: { id: string }) {
  const { t } = useTranslation();
  const job = useJob(id);
  const active = useActiveJob();
  const profiles = useProfiles();
  return (
    <QueryGate query={job} title={t("profiles.editTitle")}>
      {(data) => (
        <EditProfileForm canDelete={(profiles.data?.length ?? 0) > 1} isActive={active.data?.id === data.id} job={data} />
      )}
    </QueryGate>
  );
}
