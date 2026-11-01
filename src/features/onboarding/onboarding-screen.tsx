import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useEffect, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  BackHandler,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  LinearTransition,
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { scheduleOnRN } from "react-native-worklets";

import { useActiveJob } from "@/data/hooks/queries";
import { completeOnboarding } from "@/data/repositories/onboarding-repository";
import { updateSettings } from "@/data/repositories/settings-repository";
import type { AppLanguage } from "@/domain/entities";
import { WORK_CITIES, type WorkCity } from "@/domain/holidays/holiday-settings";
import { divideRounded, payForMinutes } from "@/domain/money/money";
import type { PayType } from "@/domain/pay/shift-pay";
import type { EmploymentType, Gender } from "@/domain/tax/tax-status";
import { errorMessage } from "@/localization/errors";
import { LANGUAGE_OPTIONS } from "@/localization/languages";
import { useAppLocalization } from "@/localization/localization-provider";
import { currencyStatementParts } from "@/shared/lib/currency-display";
import { formatStatementMoney, getAppLocale } from "@/shared/lib/format";
import { colorWithAlpha, useAppThemeColors } from "@/shared/theme/app-theme";
import { Text, TextAlignmentProvider } from "@/shared/ui/app-text";
import { AppSpinner } from "@/shared/ui/controls/app-spinner";
import { FilledIcon, type FilledIconName } from "@/shared/ui/filled-icon";
import { InputCard } from "@/shared/ui/form/cards";
import { inputToMinor, inputToWholeNumber } from "@/shared/ui/form/input-format";
import { SelectionSection } from "@/shared/ui/form/selection-section";
import { GlassSegmentedControl } from "@/shared/ui/glass-segmented-control";
import { AppAlert } from "@/shared/ui/overlay/app-alert";

import { EASE_OUT, rise, StepBadge } from "./onboarding-motion";
import { DoneMark, LogShiftScene, WelcomeScene } from "./onboarding-scenes";

/** Language first, then what makes the first shift pay correctly, then how the app is used. */
const STEPS = ["language", "welcome", "pay", "profile", "howTo"] as const;
type StepKey = (typeof STEPS)[number];

/** Steps that open with an icon badge; the others lead with their own scene. */
const ICONS: Partial<Record<StepKey, FilledIconName>> = { language: "translate", pay: "work", profile: "person" };

/** Used for the preview scene before a rate is entered (₪50/h). */
const SAMPLE_HOURLY_RATE = 5_000;
const EIGHT_HOURS = 8 * 60;
/** One step fades out, then the next fades in: each takes half. */
const TRANSITION_MS = 440;
const ACTION_HEIGHT = 58;
const ACTION_LAYOUT = LinearTransition.duration(240).easing(EASE_OUT).reduceMotion(ReduceMotion.System);
const BACK_ENTERING = FadeIn.duration(240).easing(EASE_OUT).reduceMotion(ReduceMotion.System);
const BACK_EXITING = FadeOut.duration(160).easing(EASE_OUT).reduceMotion(ReduceMotion.System);

/** One bar per step; the current one fills as it arrives. */
function StepBar({ filled }: { filled: boolean }) {
  const theme = useAppThemeColors();
  const reduce = useReducedMotion();
  const width = useSharedValue(filled ? 1 : 0);
  useEffect(() => {
    width.value = reduce ? (filled ? 1 : 0) : withTiming(filled ? 1 : 0, { duration: 420, easing: EASE_OUT });
  }, [filled, reduce, width]);
  const style = useAnimatedStyle(() => ({ width: `${width.value * 100}%` }));
  return (
    <View style={{ backgroundColor: colorWithAlpha(theme.accent, 0.16), borderRadius: 2, flex: 1, height: 4, overflow: "hidden" }}>
      <Animated.View style={[{ backgroundColor: theme.accent, borderRadius: 2, height: 4 }, style]} />
    </View>
  );
}

/** One page of the flow: the leaving page fades out, then the arriving one fades in. */
function StepPage({ index, active, arriving, departing, transition, children }: {
  index: number;
  /** The page on screen; the one leaving takes no touches. */
  active: boolean;
  arriving: SharedValue<number>;
  departing: SharedValue<number>;
  transition: SharedValue<number>;
  children: ReactNode;
}) {
  const theme = useAppThemeColors();
  const style = useAnimatedStyle(() => {
    const t = transition.get();
    if (index === arriving.get()) return { opacity: Math.max(0, t * 2 - 1) };
    if (index === departing.get()) return { opacity: Math.max(0, 1 - t * 2) };
    return { opacity: 0 };
  });
  return (
    <Animated.View
      importantForAccessibility={active ? "auto" : "no-hide-descendants"}
      pointerEvents={active ? "auto" : "none"}
      style={[StyleSheet.absoluteFill, { backgroundColor: theme.background }, style]}
    >
      {children}
    </Animated.View>
  );
}

/** A Plutus-style choice: a surface row that takes an accent border and check when chosen. */
function ChoiceRow({ label, detail, icon, selected, onPress }: {
  label: string;
  detail?: string;
  icon?: FilledIconName;
  selected: boolean;
  onPress: () => void;
}) {
  const theme = useAppThemeColors();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      className="min-h-16 flex-1 flex-row items-center gap-3 rounded-2xl border px-4 py-3"
      style={({ pressed }) => ({
        backgroundColor: selected ? colorWithAlpha(theme.accent, 0.12) : theme.surface,
        borderColor: selected ? theme.accent : "transparent",
        opacity: pressed ? 0.72 : 1,
      })}
      onPress={() => {
        Keyboard.dismiss();
        onPress();
      }}
    >
      {icon ? <FilledIcon name={icon} size={22} tone={selected ? "accent" : "muted"} /> : null}
      <View className="min-w-0 flex-1">
        <Text className={`font-manrope-semibold text-base ${selected ? "text-accent" : "text-foreground"}`}>{label}</Text>
        {detail ? <Text className="mt-0.5 font-sans text-xs text-muted">{detail}</Text> : null}
      </View>
      <View className={`size-7 items-center justify-center rounded-full ${selected ? "bg-accent" : "border-2 border-border"}`}>
        {selected ? <FilledIcon name="check" size={18} tone="accent-foreground" /> : null}
      </View>
    </Pressable>
  );
}

/** A small muted label above a group of controls. */
function GroupLabel({ children, hint }: { children: string; hint?: string }) {
  return (
    <View className="gap-0.5 px-1 pt-2">
      <Text className="font-manrope-semibold text-sm text-foreground">{children}</Text>
      {hint ? <Text className="font-sans text-xs leading-4 text-muted">{hint}</Text> : null}
    </View>
  );
}

/**
 * The first-run setup, drawn over the app by `OnboardingGate`. It asks only
 * what Chronos needs for correct pay from the first shift (language, pay,
 * tax basics, work city), shows how a shift is logged, then fades onto the app.
 * `onHoldChange(true)` keeps it on screen after the answers are saved, until it has faded away.
 */
export function OnboardingScreen({ onHoldChange }: { onHoldChange: (hold: boolean) => void }) {
  const { t } = useTranslation();
  const database = useSQLiteContext();
  const { language, isRTL } = useAppLocalization();
  const insets = useSafeAreaInsets();
  const theme = useAppThemeColors();
  const reduce = useReducedMotion();
  const job = useActiveJob();
  const currencyCode = job.data?.currencyCode ?? "ILS";

  const [phase, setPhase] = useState<"steps" | "done">("steps");
  const [step, setStep] = useState(0);
  const [leavingStep, setLeavingStep] = useState<number | null>(null);
  const [jobName, setJobName] = useState("");
  const [payType, setPayType] = useState<PayType>("hourly");
  const [hourlyRate, setHourlyRate] = useState("");
  const [monthlySalary, setMonthlySalary] = useState("");
  const [divisor, setDivisor] = useState("182");
  const [travel, setTravel] = useState("");
  const [gender, setGender] = useState<Gender | null>(null);
  const [employmentType, setEmploymentType] = useState<EmploymentType>("employee");
  const [workCity, setWorkCity] = useState<WorkCity | null>(null);
  const [citiesOpen, setCitiesOpen] = useState(true);
  const [saving, setSaving] = useState(false);
  const [leaving, setLeaving] = useState(false);

  // The arriving page slides over the one leaving. Which page arrives and which leaves live on the
  // UI thread with the motion itself, so both take their parts in the frame the motion starts.
  const transition = useSharedValue(1);
  const arriving = useSharedValue(0);
  const departing = useSharedValue(-1);
  // The finished setup fades out over the app.
  const leave = useSharedValue(1);
  const leaveStyle = useAnimatedStyle(() => ({ opacity: leave.value }));

  const key = STEPS[step];
  const rate = inputToMinor(hourlyRate);
  const salary = inputToMinor(monthlySalary);
  const hours = inputToWholeNumber(divisor);
  const travelPerDay = inputToMinor(travel);
  const hourValue = payType === "hourly" ? rate ?? 0 : salary && hours ? divideRounded(salary, hours) : 0;
  const payValid = jobName.trim().length > 0 && (payType === "hourly" ? (rate ?? 0) > 0 : (salary ?? 0) > 0 && (hours ?? 0) > 0) && travelPerDay !== null;
  const money = (amount: number) => formatStatementMoney(amount, currencyCode, language);
  const currencySymbol = currencyStatementParts(0, currencyCode, getAppLocale(language)).symbol;
  const shiftAmount = money(payForMinutes(hourValue > 0 ? hourValue : SAMPLE_HOURLY_RATE, EIGHT_HOURS));
  const disabled = saving || (key === "pay" && !payValid) || (key === "profile" && (!gender || !workCity));

  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      if (phase === "done" || saving) return true;
      if (step > 0) {
        goToStep(step - 1);
        return true;
      }
      return false;
    });
    return () => subscription.remove();
  });

  function goToStep(target: number) {
    if (target < 0 || target >= STEPS.length || target === step) return;
    Keyboard.dismiss();
    setLeavingStep(step);
    setStep(target);
    arriving.value = target;
    departing.value = step;
    if (reduce) {
      transition.value = 1;
      setLeavingStep(null);
      return;
    }
    transition.value = 0;
    transition.value = withTiming(1, { duration: TRANSITION_MS, easing: Easing.linear }, (finished) => {
      if (finished) scheduleOnRN(setLeavingStep, null);
    });
  }

  function chooseLanguage(code: AppLanguage) {
    // Saved right away, so the whole app (and its direction) switches while setup goes on.
    if (code !== language) void updateSettings(database, { appLanguage: code });
  }

  async function finish() {
    if (saving) return;
    Keyboard.dismiss();
    setSaving(true);
    // Stay on screen once the answers are saved, to show the result and fade onto the app.
    onHoldChange(true);
    try {
      await completeOnboarding(database, {
        language,
        jobName,
        payType,
        hourlyRate: rate ?? 0,
        monthlySalary: salary ?? 0,
        monthlyHoursDivisor: hours && hours > 0 ? hours : 182,
        travelPerDay: travelPerDay ?? 0,
        travelName: t("onboarding.travelName"),
        gender: gender!,
        employmentType,
        workCity: workCity!,
      });
      setPhase("done");
    } catch (error) {
      onHoldChange(false);
      AppAlert.alert(t("onboarding.failed"), errorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  /** Leaves for the app beneath: the shift editor opens first when asked, then setup fades away onto it. */
  function enterApp(addShift: boolean) {
    if (leaving) return;
    setLeaving(true);
    if (addShift) router.push("/shifts/new");
    if (reduce) {
      onHoldChange(false);
      return;
    }
    leave.value = withDelay(
      addShift ? 320 : 40,
      withTiming(0, { duration: 380, easing: EASE_OUT }, (finished) => {
        if (finished) scheduleOnRN(onHoldChange, false);
      }),
    );
  }

  function primaryAction() {
    if (disabled) return;
    if (key === "howTo") void finish();
    else goToStep(step + 1);
  }

  function stepIntro(stepKey: StepKey) {
    const icon = ICONS[stepKey];
    return (
      <View className="items-center gap-2">
        {icon ? <StepBadge icon={icon} /> : null}
        <Animated.View entering={rise(0, 40)}>
          <Text accessibilityRole="header" className="text-center font-manrope-bold text-[26px] leading-[32px] text-foreground">
            {t(`onboarding.${stepKey}`)}
          </Text>
        </Animated.View>
        <Animated.View entering={rise(1, 40)}>
          <Text className="text-center font-sans text-sm leading-5 text-muted">{t(`onboarding.${stepKey}Description`)}</Text>
        </Animated.View>
      </View>
    );
  }

  function stepControls(stepKey: StepKey) {
    switch (stepKey) {
      case "language":
        return LANGUAGE_OPTIONS.map((option, row) => (
          <Animated.View key={option.code} entering={rise(row)}>
            <ChoiceRow label={option.nativeName} selected={option.code === language} onPress={() => chooseLanguage(option.code)} />
          </Animated.View>
        ));
      case "welcome":
        return <WelcomeScene />;
      case "pay":
        return (
          <>
            <Animated.View entering={rise(0)}>
              <InputCard label={t("onboarding.jobName")} placeholder={t("onboarding.jobNamePlaceholder")} value={jobName} onChangeText={setJobName} />
            </Animated.View>
            <Animated.View entering={rise(0)}>
              <GlassSegmentedControl
                accessibilityLabel={t("onboarding.pay")}
                options={[
                  { value: "hourly", label: t("onboarding.hourly") },
                  { value: "monthly", label: t("onboarding.monthly") },
                ]}
                value={payType}
                onChange={setPayType}
              />
            </Animated.View>
            <Animated.View entering={rise(1)} className="gap-2.5">
              {payType === "hourly" ? (
                <InputCard
                  keyboardType="decimal-pad"
                  label={t("onboarding.hourlyWage")}
                  trailing={<Text className="text-lg text-muted">{currencySymbol}</Text>}
                  value={hourlyRate}
                  onChangeText={setHourlyRate}
                />
              ) : (
                <>
                  <InputCard
                    keyboardType="decimal-pad"
                    label={t("onboarding.monthlySalary")}
                    trailing={<Text className="text-lg text-muted">{currencySymbol}</Text>}
                    value={monthlySalary}
                    onChangeText={setMonthlySalary}
                  />
                  <InputCard keyboardType="number-pad" label={t("onboarding.monthlyHours")} value={divisor} onChangeText={setDivisor} />
                  <Text className="px-1 font-sans text-xs leading-4 text-muted">{t("onboarding.monthlyHoursHint")}</Text>
                </>
              )}
              <InputCard
                keyboardType="decimal-pad"
                label={`${t("onboarding.travel")} ${t("common.optional")}`}
                trailing={<Text className="text-lg text-muted">{currencySymbol}</Text>}
                value={travel}
                onChangeText={setTravel}
              />
            </Animated.View>
            {hourValue > 0 ? (
              <Animated.View
                entering={FadeIn.duration(220).reduceMotion(ReduceMotion.System)}
                className="flex-row items-center gap-2.5 rounded-2xl px-4 py-3"
                style={{ backgroundColor: colorWithAlpha(theme.accent, 0.12) }}
              >
                <FilledIcon name="payments" size={20} tone="accent" />
                <Text accessibilityLiveRegion="polite" className="min-w-0 flex-1 font-manrope-semibold text-sm text-accent">
                  {payType === "hourly"
                    ? t("onboarding.shiftPreview", { amount: shiftAmount })
                    : t("onboarding.hourValuePreview", { amount: money(hourValue) })}
                </Text>
              </Animated.View>
            ) : null}
          </>
        );
      case "profile":
        return (
          <>
            <Animated.View entering={rise(0)} className="gap-2.5">
              <GroupLabel hint={t("onboarding.genderHint")}>{t("onboarding.gender")}</GroupLabel>
              <View className="flex-row gap-2.5">
                <ChoiceRow label={t("personal.male")} selected={gender === "male"} onPress={() => setGender("male")} />
                <ChoiceRow label={t("personal.female")} selected={gender === "female"} onPress={() => setGender("female")} />
              </View>
            </Animated.View>
            <Animated.View entering={rise(1)} className="gap-2.5">
              <GroupLabel>{t("onboarding.employment")}</GroupLabel>
              <GlassSegmentedControl
                accessibilityLabel={t("onboarding.employment")}
                options={[
                  { value: "employee", label: t("taxes.employee") },
                  { value: "selfEmployed", label: t("taxes.selfEmployed") },
                ]}
                value={employmentType}
                onChange={setEmploymentType}
              />
            </Animated.View>
            <Animated.View entering={rise(2)} className="gap-1 pt-2">
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
              <Text className="px-1 pt-1 font-sans text-xs leading-4 text-muted">{t("onboarding.cityHint")}</Text>
            </Animated.View>
          </>
        );
      case "howTo":
        return <LogShiftScene amount={shiftAmount} />;
    }
  }

  function renderStep(index: number) {
    const stepKey = STEPS[index];
    return (
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + ACTION_HEIGHT + 40, paddingTop: insets.top + 64 }]}
        contentInsetAdjustmentBehavior="never"
        keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {stepIntro(stepKey)}
        <View className="gap-2.5">{stepControls(stepKey)}</View>
      </ScrollView>
    );
  }

  const glow = (
    <LinearGradient colors={[colorWithAlpha(theme.accent, 0.12), colorWithAlpha(theme.accent, 0)]} pointerEvents="none" style={styles.glow} />
  );
  const dockBottom = Math.max(insets.bottom, 10);

  if (phase === "done") {
    const payValue = payType === "hourly"
      ? t("units.perHour", { amount: money(rate ?? 0) })
      : t("units.perMonth", { amount: money(salary ?? 0) });
    const summary: { icon: FilledIconName; label: string; value: string }[] = [
      { icon: "work", label: t("onboarding.done.job"), value: jobName.trim() },
      { icon: "payments", label: t("onboarding.done.pay"), value: payValue },
      ...(travelPerDay ? [{ icon: "commute" as const, label: t("onboarding.done.travel"), value: money(travelPerDay) }] : []),
      { icon: "location", label: t("onboarding.done.city"), value: workCity ? t(`holidayPay.cities.${workCity}`) : "" },
    ];
    return (
      <TextAlignmentProvider>
        <Animated.View pointerEvents={leaving ? "none" : "auto"} style={[styles.screen, { backgroundColor: theme.background }, leaveStyle]}>
          {glow}
          <ScrollView
            contentContainerStyle={[styles.scrollContent, { paddingBottom: 24, paddingTop: insets.top + 24 }]}
            showsVerticalScrollIndicator={false}
          >
            <DoneMark />
            <View className="gap-2">
              <Animated.View entering={rise(0, 200)}>
                <Text accessibilityRole="header" className="text-center font-manrope-bold text-[28px] leading-[34px] text-foreground">
                  {t("onboarding.done.title")}
                </Text>
              </Animated.View>
              <Animated.View entering={rise(1, 200)}>
                <Text className="text-center font-sans text-[15px] leading-[22px] text-muted">{t("onboarding.done.description")}</Text>
              </Animated.View>
            </View>
            <Animated.View entering={rise(2, 260)} className="overflow-hidden rounded-[28px] bg-surface">
              {summary.map((item, index) => (
                <View key={item.label} className={`min-h-16 flex-row items-center gap-3 px-4 py-3 ${index < summary.length - 1 ? "border-b-2 border-background" : ""}`}>
                  <View className="size-9 items-center justify-center rounded-xl" style={{ backgroundColor: colorWithAlpha(theme.accent, 0.13) }}>
                    <FilledIcon name={item.icon} size={20} tone="accent" />
                  </View>
                  <Text className="min-w-0 flex-1 font-manrope-semibold text-base text-foreground">{item.label}</Text>
                  <Text className="font-manrope-semibold text-base text-muted" numberOfLines={1}>{item.value}</Text>
                </View>
              ))}
            </Animated.View>
          </ScrollView>
          <Animated.View entering={rise(4, 420)} className="gap-2.5 px-3 pt-2" style={{ paddingBottom: dockBottom }}>
            <DockButton icon="add" label={t("onboarding.done.firstShift")} onPress={() => enterApp(true)} />
            <DockButton icon="home" label={t("onboarding.done.start")} tone="secondary" onPress={() => enterApp(false)} />
          </Animated.View>
        </Animated.View>
      </TextAlignmentProvider>
    );
  }

  // The page leaving is drawn first, under the one arriving.
  const pages = leavingStep !== null && leavingStep !== step ? [leavingStep, step] : [step];
  const actionLabel = saving
    ? t("onboarding.saving")
    : t(key === "welcome" ? "onboarding.start" : key === "howTo" ? "onboarding.finish" : "onboarding.continue");

  return (
    <TextAlignmentProvider>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={[styles.screen, { backgroundColor: theme.background }]}>
        {/* The inner view shrinks with the keyboard, so the dock pinned to its bottom rises above it. */}
        <View style={styles.screen}>
          <View style={styles.stage}>
            {/* Both pages keep their keys while one slides over the other, so the one
                leaving is the same view that was on screen and never replays its entrance. */}
            {pages.map((index) => (
              <StepPage key={index} active={index === step} arriving={arriving} departing={departing} index={index} transition={transition}>
                {glow}
                {renderStep(index)}
              </StepPage>
            ))}
          </View>
          {/* Scrolled content fades out under the progress bar and the buttons. */}
          <LinearGradient
            colors={[colorWithAlpha(theme.background, 1), colorWithAlpha(theme.background, 0.94), colorWithAlpha(theme.background, 0)]}
            locations={[0, 0.6, 1]}
            pointerEvents="none"
            style={[styles.fade, { height: insets.top + 56, top: 0 }]}
          />
          <LinearGradient
            colors={[colorWithAlpha(theme.background, 0), colorWithAlpha(theme.background, 0.94), colorWithAlpha(theme.background, 1)]}
            locations={[0, 0.45, 1]}
            pointerEvents="none"
            style={[styles.fade, { bottom: 0, height: dockBottom + ACTION_HEIGHT + 36 }]}
          />
          <View
            accessibilityLabel={t("onboarding.progress", { current: step + 1, total: STEPS.length })}
            accessibilityRole="progressbar"
            pointerEvents="none"
            style={[styles.header, { top: insets.top + 12 }]}
          >
            {STEPS.map((item, index) => (
              <StepBar key={item} filled={index <= step} />
            ))}
          </View>
          <View pointerEvents="box-none" style={[styles.dock, { bottom: dockBottom }]}>
            {step > 0 ? (
              <Animated.View entering={BACK_ENTERING} exiting={BACK_EXITING} layout={ACTION_LAYOUT} style={styles.backSlot}>
                <Pressable
                  accessibilityLabel={t("onboarding.back")}
                  accessibilityRole="button"
                  disabled={saving}
                  style={({ pressed }) => [styles.action, styles.backAction, { backgroundColor: theme.surface, borderColor: theme.border }, pressed && styles.pressed]}
                  onPress={() => goToStep(step - 1)}
                >
                  <FilledIcon name="arrow-left" size={22} style={{ transform: [{ scaleX: isRTL ? -1 : 1 }] }} />
                </Pressable>
              </Animated.View>
            ) : null}
            <Animated.View layout={ACTION_LAYOUT} style={styles.actionSlot}>
              <Pressable
                accessibilityLabel={actionLabel}
                accessibilityRole="button"
                accessibilityState={{ busy: saving, disabled }}
                disabled={disabled}
                style={({ pressed }) => [styles.action, { backgroundColor: disabled ? theme.surface : theme.accent }, pressed && styles.pressed]}
                onPress={primaryAction}
              >
                {saving ? <AppSpinner /> : <FilledIcon color={disabled ? theme.muted : theme.accentForeground} name={key === "howTo" ? "check" : "chevron-right"} size={24} />}
                <Animated.View key={actionLabel} entering={FadeIn.duration(180).reduceMotion(ReduceMotion.System)} style={{ flexShrink: 1 }}>
                  {/* The label takes the icon's exact color, so the two always match. */}
                  <Text className="font-manrope-bold text-base" numberOfLines={1} style={{ color: disabled ? theme.muted : theme.accentForeground }}>
                    {actionLabel}
                  </Text>
                </Animated.View>
              </Pressable>
            </Animated.View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </TextAlignmentProvider>
  );
}

/** A full-width dock button: accent for the main choice, surface for the other. */
function DockButton({ icon, label, onPress, tone = "primary" }: { icon: FilledIconName; label: string; onPress: () => void; tone?: "primary" | "secondary" }) {
  const theme = useAppThemeColors();
  const primary = tone === "primary";
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.action,
        primary ? { backgroundColor: theme.accent } : { backgroundColor: theme.surface, borderColor: theme.border, borderWidth: 1 },
        pressed && styles.pressed,
      ]}
      onPress={onPress}
    >
      <FilledIcon color={primary ? theme.accentForeground : theme.foreground} name={icon} size={24} weight={600} />
      <Text className="font-manrope-bold text-base" numberOfLines={1} style={{ color: primary ? theme.accentForeground : theme.foreground }}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  stage: { flex: 1, overflow: "hidden" },
  glow: { height: 320, left: 0, position: "absolute", right: 0, top: 0 },
  fade: { left: 0, position: "absolute", right: 0, zIndex: 10 },
  header: { flexDirection: "row", gap: 6, left: 0, paddingHorizontal: 20, position: "absolute", right: 0, zIndex: 20 },
  scrollContent: { flexGrow: 1, gap: 20, justifyContent: "center", paddingHorizontal: 20 },
  dock: { flexDirection: "row", gap: 8, left: 0, paddingHorizontal: 12, position: "absolute", right: 0, zIndex: 20 },
  action: {
    alignItems: "center",
    borderRadius: 29,
    flexDirection: "row",
    gap: 10,
    height: ACTION_HEIGHT,
    justifyContent: "center",
    overflow: "hidden",
    paddingHorizontal: 16,
  },
  actionSlot: { flex: 1 },
  backSlot: { width: ACTION_HEIGHT },
  backAction: { borderWidth: 1, paddingHorizontal: 0 },
  pressed: { opacity: 0.78, transform: [{ scale: 0.985 }] },
});
