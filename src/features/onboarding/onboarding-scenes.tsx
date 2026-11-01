import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import Animated, { useAnimatedProps, useAnimatedStyle, type SharedValue } from "react-native-reanimated";
import Svg, { Circle } from "react-native-svg";

import { formatTime } from "@/shared/lib/format";
import { colorWithAlpha, useAppThemeColors } from "@/shared/theme/app-theme";
import { Text } from "@/shared/ui/app-text";
import { FilledIcon, type FilledIconName } from "@/shared/ui/filled-icon";

import { beat, pop, rise, useBeatStyle, useLoop, visibleBetween } from "./onboarding-motion";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/* ------------------------------------------------------------------ */
/* Shared pieces                                                       */
/* ------------------------------------------------------------------ */

/** A row under a scene that lights up while the scene shows it. */
export function ExplainRow({ clock, from, to, icon, title, detail }: {
  clock: SharedValue<number>;
  from: number;
  to: number;
  icon: FilledIconName;
  title: string;
  detail: string;
}) {
  const theme = useAppThemeColors();
  const active = useAnimatedStyle(() => ({ opacity: 0.42 + 0.58 * visibleBetween(clock.value, from, to - 0.02, 0.03) }));
  const disc = useAnimatedStyle(() => ({ transform: [{ scale: 1 + 0.08 * visibleBetween(clock.value, from, to - 0.02, 0.03) }] }));
  return (
    <Animated.View style={[{ alignItems: "center", flexDirection: "row", gap: 12, paddingVertical: 8 }, active]}>
      <Animated.View className="size-10 items-center justify-center rounded-full" style={[{ backgroundColor: colorWithAlpha(theme.accent, 0.13) }, disc]}>
        <FilledIcon color={theme.accent} name={icon} size={20} />
      </Animated.View>
      <View className="min-w-0 flex-1 gap-0.5">
        <Text className="font-manrope-bold text-[15px] text-foreground">{title}</Text>
        <Text className="font-sans text-[13px] leading-[18px] text-muted">{detail}</Text>
      </View>
    </Animated.View>
  );
}

/** A ring that ripples out from a tap at `at`. */
function TapRing({ clock, at, size }: { clock: SharedValue<number>; at: number; size: number }) {
  const theme = useAppThemeColors();
  const style = useAnimatedStyle(() => {
    const t = beat(clock.value, at, at + 0.08);
    const shown = visibleBetween(clock.value, at, at + 0.07, 0.01);
    return { opacity: 0.55 * shown * (1 - t), transform: [{ scale: 0.7 + t * 0.9 }] };
  });
  return (
    <Animated.View
      pointerEvents="none"
      style={[{ borderColor: theme.accent, borderRadius: size, borderWidth: 2, height: size * 1.4, position: "absolute", width: size * 1.4 }, style]}
    />
  );
}

/** The fingertip that comes in just before a tap and leaves after it. */
function Finger({ clock, at }: { clock: SharedValue<number>; at: number }) {
  const theme = useAppThemeColors();
  const style = useAnimatedStyle(() => {
    const shown = visibleBetween(clock.value, at - 0.06, at + 0.05, 0.03);
    const press = visibleBetween(clock.value, at - 0.005, at + 0.03, 0.01);
    return { opacity: shown, transform: [{ translateY: 14 + (1 - shown) * 12 }, { scale: 1 - press * 0.12 }] };
  });
  return (
    <Animated.View pointerEvents="none" style={[{ position: "absolute" }, style]}>
      <FilledIcon color={theme.foreground} name="touch" size={30} />
    </Animated.View>
  );
}

/* ------------------------------------------------------------------ */
/* Welcome: the shift clock                                            */
/* ------------------------------------------------------------------ */

const HERO = 216;
const DIAL = 132;
const STROKE = 10;
const ORBIT = 94;
const WELCOME_LOOP_MS = 9000;

/** What a shift is worth, coming out of the clock one after another. */
const BADGES: { icon: FilledIconName; angle: number }[] = [
  { icon: "payments", angle: -50 },
  { icon: "more-time", angle: 30 },
  { icon: "night", angle: 150 },
  { icon: "celebration", angle: 230 },
];

/** The welcome hero: a shift fills the clock while what it pays appears around it. */
export function WelcomeScene() {
  const { t } = useTranslation();
  const clock = useLoop(WELCOME_LOOP_MS, 0.7);
  const rows = [
    { icon: "clock" as const, title: t("onboarding.welcomePoints.logTitle"), detail: t("onboarding.welcomePoints.logDetail") },
    { icon: "more-time" as const, title: t("onboarding.welcomePoints.ratesTitle"), detail: t("onboarding.welcomePoints.ratesDetail") },
    { icon: "wallet" as const, title: t("onboarding.welcomePoints.salaryTitle"), detail: t("onboarding.welcomePoints.salaryDetail") },
  ];
  return (
    <View className="gap-4">
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{ alignItems: "center", alignSelf: "center", height: HERO, justifyContent: "center", width: HERO }}
      >
        <Halo clock={clock} />
        <Animated.View entering={pop(80)}>
          <ShiftDial clock={clock} />
        </Animated.View>
        <View style={{ alignItems: "center", height: 0, justifyContent: "center", width: 0 }}>
          {BADGES.map((badge, index) => (
            <OrbitBadge key={badge.icon} angle={badge.angle} clock={clock} from={0.18 + index * 0.16} icon={badge.icon} />
          ))}
        </View>
      </View>
      <Animated.View entering={rise(3, 200)}>
        {rows.map((row, index) => (
          <ExplainRow key={row.icon} clock={clock} detail={row.detail} from={index / 3} icon={row.icon} title={row.title} to={(index + 1) / 3} />
        ))}
      </Animated.View>
    </View>
  );
}

/** A soft glow behind the clock that breathes with the loop. */
function Halo({ clock }: { clock: SharedValue<number> }) {
  const theme = useAppThemeColors();
  const style = useAnimatedStyle(() => {
    const wave = (Math.sin(clock.value * Math.PI * 6) + 1) / 2;
    return { opacity: 0.55 + 0.45 * wave, transform: [{ scale: 0.92 + 0.08 * wave }] };
  });
  return <Animated.View style={[{ backgroundColor: colorWithAlpha(theme.accent, 0.12), borderRadius: 90, height: 180, position: "absolute", width: 180 }, style]} />;
}

/** The clock face: the arc is the shift being worked, the hand runs the hours. */
function ShiftDial({ clock }: { clock: SharedValue<number> }) {
  const theme = useAppThemeColors();
  const radius = (DIAL - STROKE) / 2;
  const length = 2 * Math.PI * radius;
  const arc = useAnimatedProps(() => {
    // The shift fills the dial, holds, then clears before the loop starts again.
    const filled = beat(clock.value, 0.04, 0.8) * (1 - beat(clock.value, 0.92, 0.99));
    return { strokeDashoffset: length * (1 - filled), strokeOpacity: filled > 0.004 ? 1 : 0 };
  });
  const hand = useAnimatedStyle(() => ({ transform: [{ rotate: `${clock.value * 720}deg` }] }));
  return (
    <View style={{ alignItems: "center", height: DIAL, justifyContent: "center", width: DIAL }}>
      <View style={{ backgroundColor: theme.surface, borderRadius: DIAL / 2, height: DIAL - STROKE * 2, position: "absolute", width: DIAL - STROKE * 2 }} />
      <Svg height={DIAL} style={{ position: "absolute" }} width={DIAL}>
        <Circle cx={DIAL / 2} cy={DIAL / 2} fill="none" r={radius} stroke={colorWithAlpha(theme.accent, 0.16)} strokeWidth={STROKE} />
        <AnimatedCircle
          animatedProps={arc}
          cx={DIAL / 2}
          cy={DIAL / 2}
          fill="none"
          origin={`${DIAL / 2}, ${DIAL / 2}`}
          r={radius}
          rotation={-90}
          stroke={theme.accent}
          strokeDasharray={`${length} ${length}`}
          strokeLinecap="round"
          strokeWidth={STROKE}
        />
      </Svg>
      {[0, 90, 180, 270].map((angle) => (
        <View key={angle} style={{ alignItems: "center", height: DIAL - STROKE * 2 - 8, position: "absolute", transform: [{ rotate: `${angle}deg` }], width: 4 }}>
          <View style={{ backgroundColor: colorWithAlpha(theme.foreground, 0.25), borderRadius: 2, height: 8, width: 3 }} />
        </View>
      ))}
      <Animated.View style={[{ alignItems: "center", height: DIAL - STROKE * 2 - 30, position: "absolute", width: 6 }, hand]}>
        <View style={{ backgroundColor: theme.accent, borderRadius: 3, flex: 0.5, width: 5 }} />
      </Animated.View>
      <View style={{ backgroundColor: theme.accent, borderColor: theme.surface, borderRadius: 8, borderWidth: 3, height: 16, width: 16 }} />
    </View>
  );
}

/** A small badge that floats out of the clock to its place on the orbit. */
function OrbitBadge({ clock, from, angle, icon }: { clock: SharedValue<number>; from: number; angle: number; icon: FilledIconName }) {
  const theme = useAppThemeColors();
  const radians = (angle * Math.PI) / 180;
  const style = useAnimatedStyle(() => {
    const out = beat(clock.value, from, from + 0.1);
    const shown = visibleBetween(clock.value, from, 0.9, 0.04);
    return {
      opacity: shown,
      transform: [
        { translateX: Math.cos(radians) * ORBIT * (0.55 + 0.45 * out) },
        { translateY: Math.sin(radians) * ORBIT * (0.55 + 0.45 * out) },
        { scale: 0.6 + 0.4 * out },
      ],
    };
  });
  return (
    <Animated.View style={[{ height: 0, position: "absolute", width: 0 }, style]}>
      <View
        style={{
          alignItems: "center",
          backgroundColor: theme.surface,
          borderColor: colorWithAlpha(theme.accent, 0.4),
          borderRadius: 22,
          borderWidth: 1.5,
          height: 44,
          justifyContent: "center",
          left: -22,
          position: "absolute",
          top: -22,
          width: 44,
        }}
      >
        <FilledIcon color={theme.accent} name={icon} size={22} />
      </View>
    </Animated.View>
  );
}

/* ------------------------------------------------------------------ */
/* How to: logging a shift                                             */
/* ------------------------------------------------------------------ */

const HOW_TO_LOOP_MS = 9600;
/** Beats of the loop: tap +, set the times and save, see the shift, see the month. */
const TAP_PLUS = 0.12;
const SHEET_FROM = 0.2;
const TAP_SAVE = 0.44;
const ROW_FROM = 0.52;
const MONTH_FROM = 0.72;
const SCENE_HEIGHT = 236;
const SAMPLE_START = new Date(2026, 0, 1, 8, 0);
const SAMPLE_END = new Date(2026, 0, 1, 16, 0);

/**
 * A small Home screen acting out the daily routine: tap +, set the times,
 * save, and the shift appears with its pay, then the month adds up.
 * `amount` is what an 8-hour shift pays at the user's own rate.
 */
export function LogShiftScene({ amount }: { amount: string }) {
  const { t } = useTranslation();
  const clock = useLoop(HOW_TO_LOOP_MS, 0.8);
  const rows = [
    { icon: "add" as const, title: t("onboarding.howToPoints.addTitle"), detail: t("onboarding.howToPoints.addDetail"), from: 0, to: ROW_FROM },
    { icon: "payments" as const, title: t("onboarding.howToPoints.paidTitle"), detail: t("onboarding.howToPoints.paidDetail"), from: ROW_FROM, to: MONTH_FROM },
    { icon: "chart" as const, title: t("onboarding.howToPoints.statsTitle"), detail: t("onboarding.howToPoints.statsDetail"), from: MONTH_FROM, to: 1 },
  ];
  return (
    <View className="gap-4">
      <Animated.View
        accessibilityElementsHidden
        entering={rise(0, 120)}
        importantForAccessibility="no-hide-descendants"
        className="gap-3 overflow-hidden rounded-[28px] bg-surface p-4"
      >
        <View style={{ alignItems: "center", height: 30, justifyContent: "center" }}>
          <Caption clock={clock} from={0} icon="add" until={SHEET_FROM - 0.02}>{t("onboarding.scene.tapPlus")}</Caption>
          <Caption clock={clock} from={SHEET_FROM} icon="clock" until={ROW_FROM - 0.03}>{t("onboarding.scene.setTimes")}</Caption>
          <Caption clock={clock} from={ROW_FROM} icon="payments" until={MONTH_FROM - 0.02}>{t("onboarding.scene.paid")}</Caption>
          <Caption clock={clock} from={MONTH_FROM} icon="chart" until={0.95}>{t("onboarding.scene.month")}</Caption>
        </View>
        <View style={{ height: SCENE_HEIGHT }}>
          <MiniHome amount={amount} clock={clock} />
          <MiniSheet clock={clock} />
        </View>
      </Animated.View>
      <Animated.View entering={rise(2, 200)}>
        {rows.map((row) => (
          <ExplainRow key={row.icon} clock={clock} detail={row.detail} from={row.from} icon={row.icon} title={row.title} to={row.to} />
        ))}
      </Animated.View>
    </View>
  );
}

/** A caption chip that shows during its beat; several share one place and take turns. */
function Caption({ clock, from, until, icon, children }: { clock: SharedValue<number>; from: number; until: number; icon: FilledIconName; children: ReactNode }) {
  const theme = useAppThemeColors();
  const style = useAnimatedStyle(() => {
    const shown = visibleBetween(clock.value, from, until, 0.025);
    return { opacity: shown, transform: [{ translateY: (1 - beat(clock.value, from, from + 0.05)) * 8 }] };
  });
  return (
    <Animated.View
      style={[{ alignItems: "center", backgroundColor: theme.background, borderRadius: 999, flexDirection: "row", gap: 6, paddingHorizontal: 12, paddingVertical: 6, position: "absolute" }, style]}
    >
      <FilledIcon color={theme.accent} name={icon} size={15} />
      <Text className="font-manrope-semibold text-[13px] text-foreground">{children}</Text>
    </Animated.View>
  );
}

/** The Home list behind the sheet: empty at first, then the new shift and the month. */
function MiniHome({ clock, amount }: { clock: SharedValue<number>; amount: string }) {
  const { t } = useTranslation();
  const theme = useAppThemeColors();
  // The page dims while the sheet is up, like a backdrop.
  const page = useAnimatedStyle(() => ({ opacity: 1 - 0.6 * visibleBetween(clock.value, SHEET_FROM, ROW_FROM - 0.04, 0.04) }));
  const empty = useAnimatedStyle(() => ({ opacity: 1 - beat(clock.value, ROW_FROM - 0.04, ROW_FROM) }));
  const row = useBeatStyle(clock, ROW_FROM, 0.95, 18);
  const month = useBeatStyle(clock, MONTH_FROM, 0.95, 14);
  const bar = useAnimatedStyle(() => ({ width: `${12 + 58 * beat(clock.value, MONTH_FROM + 0.03, MONTH_FROM + 0.16)}%` }));
  const fab = useAnimatedStyle(() => ({ transform: [{ scale: 1 - 0.12 * visibleBetween(clock.value, TAP_PLUS - 0.005, TAP_PLUS + 0.03, 0.01) }] }));
  return (
    <Animated.View style={[{ flex: 1, gap: 10 }, page]}>
      <Text className="font-manrope-bold text-lg text-foreground">{t("home.shiftListTitle")}</Text>
      <View style={{ height: 70 }}>
        <Animated.View style={[{ alignItems: "center", gap: 6, inset: 0, justifyContent: "center", position: "absolute" }, empty]}>
          <View className="size-9 items-center justify-center rounded-full bg-background">
            <FilledIcon name="work" size={18} tone="muted" />
          </View>
          <Text className="text-center font-sans text-xs text-muted">{t("home.shiftListEmpty")}</Text>
        </Animated.View>
        <Animated.View style={[{ alignItems: "center", backgroundColor: theme.background, borderRadius: 20, flexDirection: "row", gap: 10, inset: 0, padding: 8, position: "absolute" }, row]}>
          <View className="h-[54px] w-12 items-center justify-center rounded-[16px] bg-accent">
            <FilledIcon name="calendar" size={20} tone="accent-foreground" />
          </View>
          <View className="min-w-0 flex-1 gap-0.5">
            <Text className="font-manrope-semibold text-sm text-foreground" numberOfLines={1}>{t("onboarding.scene.shift")}</Text>
            <Text className="font-sans text-xs text-muted" style={{ fontVariant: ["tabular-nums"] }}>
              {`⁦${formatTime(SAMPLE_START)} – ${formatTime(SAMPLE_END)}⁩ · ${t("units.hours", { value: 8 })}`}
            </Text>
          </View>
          <Text className="font-manrope-bold text-base text-accent" numberOfLines={1}>{amount}</Text>
        </Animated.View>
      </View>
      <Animated.View style={[{ backgroundColor: theme.background, borderRadius: 20, gap: 8, padding: 12 }, month]}>
        <View className="flex-row items-center justify-between gap-2">
          <Text className="font-manrope-semibold text-xs text-muted">{t("home.thisMonth")}</Text>
          <Text className="font-manrope-bold text-sm text-foreground">{amount}</Text>
        </View>
        <View style={{ backgroundColor: colorWithAlpha(theme.accent, 0.16), borderRadius: 4, height: 8, overflow: "hidden" }}>
          <Animated.View style={[{ backgroundColor: theme.accent, borderRadius: 4, height: 8 }, bar]} />
        </View>
      </Animated.View>
      <View style={{ alignItems: "center", bottom: 0, end: 0, height: 52, justifyContent: "center", position: "absolute", width: 52 }}>
        <TapRing at={TAP_PLUS} clock={clock} size={44} />
        <Animated.View className="size-[52px] items-center justify-center rounded-full bg-accent" style={fab}>
          <FilledIcon name="add" size={28} tone="accent-foreground" weight={600} />
        </Animated.View>
        <Finger at={TAP_PLUS} clock={clock} />
      </View>
    </Animated.View>
  );
}

/** The "New shift" sheet: rises, shows the times, and saves. */
function MiniSheet({ clock }: { clock: SharedValue<number> }) {
  const { t } = useTranslation();
  const theme = useAppThemeColors();
  const sheet = useAnimatedStyle(() => {
    const up = beat(clock.value, SHEET_FROM, SHEET_FROM + 0.07) * (1 - beat(clock.value, ROW_FROM - 0.05, ROW_FROM));
    return { opacity: Math.min(1, up * 1.6), transform: [{ translateY: (1 - up) * 140 }] };
  });
  const save = useAnimatedStyle(() => ({ transform: [{ scale: 1 - 0.06 * visibleBetween(clock.value, TAP_SAVE - 0.005, TAP_SAVE + 0.03, 0.01) }] }));
  const times = [
    { label: t("onboarding.scene.start"), value: formatTime(SAMPLE_START), at: SHEET_FROM + 0.06 },
    { label: t("onboarding.scene.end"), value: formatTime(SAMPLE_END), at: SHEET_FROM + 0.12 },
  ];
  return (
    <Animated.View
      pointerEvents="none"
      style={[{ backgroundColor: theme.background, borderRadius: 24, bottom: 0, gap: 10, left: 0, padding: 14, position: "absolute", right: 0 }, sheet]}
    >
      <View style={{ alignSelf: "center", backgroundColor: theme.border, borderRadius: 2, height: 4, width: 36 }} />
      <Text className="font-manrope-bold text-base text-foreground">{t("onboarding.scene.newShift")}</Text>
      <View className="flex-row gap-2.5">
        {times.map((time) => (
          <SheetTime key={time.label} at={time.at} clock={clock} label={time.label} value={time.value} />
        ))}
      </View>
      <View style={{ alignItems: "center", justifyContent: "center" }}>
        <TapRing at={TAP_SAVE} clock={clock} size={40} />
        <Animated.View className="h-11 w-full flex-row items-center justify-center gap-2 rounded-full bg-accent" style={save}>
          <FilledIcon name="save" size={18} tone="accent-foreground" />
          <Text className="font-manrope-bold text-sm text-accent-foreground">{t("onboarding.scene.save")}</Text>
        </Animated.View>
        <Finger at={TAP_SAVE} clock={clock} />
      </View>
    </Animated.View>
  );
}

/** One time card in the sheet; its value lights up when it is "picked". */
function SheetTime({ clock, at, label, value }: { clock: SharedValue<number>; at: number; label: string; value: string }) {
  const theme = useAppThemeColors();
  const style = useAnimatedStyle(() => {
    const picked = visibleBetween(clock.value, at, at + 0.06, 0.015);
    return { borderColor: picked > 0.5 ? theme.accent : "transparent", transform: [{ scale: 1 + 0.03 * picked }] };
  });
  return (
    <Animated.View style={[{ backgroundColor: theme.surface, borderRadius: 16, borderWidth: 1.5, flex: 1, gap: 2, paddingHorizontal: 12, paddingVertical: 8 }, style]}>
      <View className="flex-row items-center gap-1.5">
        <FilledIcon name="clock" size={14} tone="muted" />
        <Text className="font-manrope-medium text-xs text-muted">{label}</Text>
      </View>
      <Text className="font-manrope-semibold text-base text-foreground" style={{ fontVariant: ["tabular-nums"], writingDirection: "ltr" }}>{value}</Text>
    </Animated.View>
  );
}

/** The finish mark: a check that pops in and sends out a ring. */
export function DoneMark() {
  const theme = useAppThemeColors();
  const clock = useLoop(2400, 1);
  const ring = useAnimatedStyle(() => {
    const t = beat(clock.value, 0.1, 0.7);
    return { opacity: 0.5 * (1 - t), transform: [{ scale: 1 + t * 0.6 }] };
  });
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ alignItems: "center", alignSelf: "center", height: 120, justifyContent: "center", width: 120 }}>
      <Animated.View style={[{ borderColor: theme.accent, borderRadius: 48, borderWidth: 2, height: 96, position: "absolute", width: 96 }, ring]} />
      <Animated.View entering={pop(60)} style={{ alignItems: "center", backgroundColor: theme.accent, borderRadius: 48, height: 96, justifyContent: "center", width: 96 }}>
        <FilledIcon name="check" size={52} tone="accent-foreground" weight={600} />
      </Animated.View>
    </View>
  );
}
