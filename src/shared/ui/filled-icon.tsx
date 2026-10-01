import { AddFill, AddFillW600 } from "@material-symbols-svg/react-native/rounded/icons/add";
import { BarChartFill, BarChartFillW600 } from "@material-symbols-svg/react-native/rounded/icons/bar-chart";
import { BedtimeFill } from "@material-symbols-svg/react-native/rounded/icons/bedtime";
import { CalendarAddOnFill } from "@material-symbols-svg/react-native/rounded/icons/calendar-add-on";
import { CalendarMonthFill } from "@material-symbols-svg/react-native/rounded/icons/calendar-month";
import { CheckFill } from "@material-symbols-svg/react-native/rounded/icons/check";
import { ChevronLeftFill } from "@material-symbols-svg/react-native/rounded/icons/chevron-left";
import { ChevronRightFill } from "@material-symbols-svg/react-native/rounded/icons/chevron-right";
import { DarkModeFill } from "@material-symbols-svg/react-native/rounded/icons/dark-mode";
import { HomeFill } from "@material-symbols-svg/react-native/rounded/icons/home";
import { PaletteFill } from "@material-symbols-svg/react-native/rounded/icons/palette";
import { PaymentsFill } from "@material-symbols-svg/react-native/rounded/icons/payments";
import { PlayArrowFill, PlayArrowFillW600 } from "@material-symbols-svg/react-native/rounded/icons/play-arrow";
import { ReceiptLongFill } from "@material-symbols-svg/react-native/rounded/icons/receipt-long";
import { ScheduleFill } from "@material-symbols-svg/react-native/rounded/icons/schedule";
import { SettingsFill } from "@material-symbols-svg/react-native/rounded/icons/settings";
import { StopFill, StopFillW600 } from "@material-symbols-svg/react-native/rounded/icons/stop";
import { WorkFill } from "@material-symbols-svg/react-native/rounded/icons/work";
import { BeachAccessFill } from "@material-symbols-svg/react-native/rounded/icons/beach-access";
import { SickFill } from "@material-symbols-svg/react-native/rounded/icons/sick";
import { EditCalendarFill } from "@material-symbols-svg/react-native/rounded/icons/edit-calendar";
import { EventRepeatFill } from "@material-symbols-svg/react-native/rounded/icons/event-repeat";
import { ShareFill } from "@material-symbols-svg/react-native/rounded/icons/share";
import { CalculateFill } from "@material-symbols-svg/react-native/rounded/icons/calculate";
import { PersonFill } from "@material-symbols-svg/react-native/rounded/icons/person";
import { TuneFill } from "@material-symbols-svg/react-native/rounded/icons/tune";
import { TrendingUpFill } from "@material-symbols-svg/react-native/rounded/icons/trending-up";
import { TrendingDownFill } from "@material-symbols-svg/react-native/rounded/icons/trending-down";
import { DeleteFill } from "@material-symbols-svg/react-native/rounded/icons/delete";
import { InfoFill } from "@material-symbols-svg/react-native/rounded/icons/info";
import { BadgeFill } from "@material-symbols-svg/react-native/rounded/icons/badge";
import { AccountBalanceWalletFill } from "@material-symbols-svg/react-native/rounded/icons/account-balance-wallet";
import { EditNoteFill } from "@material-symbols-svg/react-native/rounded/icons/edit-note";
import { CloseFill } from "@material-symbols-svg/react-native/rounded/icons/close";
import { ViewWeekFill } from "@material-symbols-svg/react-native/rounded/icons/view-week";
import { SavingsFill } from "@material-symbols-svg/react-native/rounded/icons/savings";
import { ArrowBackFill } from "@material-symbols-svg/react-native/rounded/icons/arrow-back";
import { ArrowForwardFill } from "@material-symbols-svg/react-native/rounded/icons/arrow-forward";
import { SaveFill } from "@material-symbols-svg/react-native/rounded/icons/save";
import { NotesFill } from "@material-symbols-svg/react-native/rounded/icons/notes";
import { TimerFill } from "@material-symbols-svg/react-native/rounded/icons/timer";
import type { IconProps, MaterialSymbolsComponent } from "@material-symbols-svg/react-native/rounded/w400";
import { useThemeColor } from "heroui-native";
import { useAppLocalization } from "@/localization/localization-provider";

/**
 * Filled Material Symbols (rounded), the same icon family as Plutus.
 * Import each icon file directly — the package is huge, so this keeps the
 * bundle small. Add new icons to `icons` and give them a short app name.
 */
const icons = {
  add: AddFill,
  calendar: CalendarMonthFill,
  "calendar-add": CalendarAddOnFill,
  chart: BarChartFill,
  check: CheckFill,
  "chevron-left": ChevronLeftFill,
  "chevron-right": ChevronRightFill,
  clock: ScheduleFill,
  "dark-mode": DarkModeFill,
  home: HomeFill,
  night: BedtimeFill,
  palette: PaletteFill,
  payments: PaymentsFill,
  play: PlayArrowFill,
  receipt: ReceiptLongFill,
  settings: SettingsFill,
  stop: StopFill,
  work: WorkFill,
  "beach": BeachAccessFill,
  "sick": SickFill,
  "edit-calendar": EditCalendarFill,
  "repeat": EventRepeatFill,
  "share": ShareFill,
  "calculate": CalculateFill,
  "person": PersonFill,
  "tune": TuneFill,
  "trending-up": TrendingUpFill,
  "trending-down": TrendingDownFill,
  "delete": DeleteFill,
  "info": InfoFill,
  "badge": BadgeFill,
  "wallet": AccountBalanceWalletFill,
  "edit-note": EditNoteFill,
  "close": CloseFill,
  "week": ViewWeekFill,
  "savings": SavingsFill,
  "arrow-left": ArrowBackFill,
  save: SaveFill,
  notes: NotesFill,
  timer: TimerFill,
} as const satisfies Record<string, MaterialSymbolsComponent>;

export type FilledIconName = keyof typeof icons;

const boldIcons = {
  add: AddFillW600,
  chart: BarChartFillW600,
  play: PlayArrowFillW600,
  stop: StopFillW600,
} satisfies Partial<Record<FilledIconName, MaterialSymbolsComponent>>;

/** Directional icons are mirrored in right-to-left layouts (Hebrew). */
const rtlIcons = {
  "arrow-left": ArrowForwardFill,
  "chevron-left": ChevronRightFill,
  "chevron-right": ChevronLeftFill,
} satisfies Partial<Record<FilledIconName, MaterialSymbolsComponent>>;

type FilledIconProps = Omit<IconProps, "color"> & {
  color?: string;
  name: FilledIconName;
  tone?: "accent" | "accent-foreground" | "danger" | "foreground" | "muted" | "success";
  weight?: 400 | 600;
};

export function FilledIcon({ color, name, tone = "foreground", weight = 400, ...props }: FilledIconProps) {
  const { isRTL } = useAppLocalization();
  const [accent, accentForeground, danger, foreground, muted, success] = useThemeColor([
    "accent",
    "accent-foreground",
    "danger",
    "foreground",
    "muted",
    "success",
  ]);
  const toneColors = { accent, "accent-foreground": accentForeground, danger, foreground, muted, success };
  const Icon =
    isRTL && name in rtlIcons
      ? rtlIcons[name as keyof typeof rtlIcons]
      : weight === 600 && name in boldIcons
        ? boldIcons[name as keyof typeof boldIcons]
        : icons[name];

  return <Icon color={color ?? toneColors[tone]} {...props} />;
}
