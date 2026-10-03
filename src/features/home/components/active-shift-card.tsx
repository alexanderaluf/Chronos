import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { Pressable } from "react-native";

import { useJobs } from "@/data/hooks/queries";
import type { Shift } from "@/domain/entities";
import { formatDuration, fromIso } from "@/domain/time/time";
import { useNow } from "@/features/shifts/hooks/use-now";
import { formatTime } from "@/shared/lib/format";
import { Text } from "@/shared/ui/app-text";
import { FilledIcon } from "@/shared/ui/filled-icon";
import { Panel } from "@/shared/ui/section";

/** The running shift: a live timer and a clock-out button. */
export function ActiveShiftCard({ openShift, onToggle }: { openShift: Shift; onToggle: () => void }) {
  const { t } = useTranslation();
  const now = useNow(1_000);
  const jobs = useJobs();
  const start = fromIso(openShift.startAt);
  const job = jobs.data?.find((item) => item.id === openShift.jobId);
  const elapsedSeconds = Math.max(0, Math.floor((now.getTime() - start.getTime()) / 1000));

  return (
    <Panel className="flex-row items-center gap-4 bg-accent">
      <Pressable accessibilityRole="button" className="flex-1 gap-1" onPress={() => router.push(`/shifts/${openShift.id}`)}>
        <Text className="text-sm text-accent-foreground">
          {job ? t("home.onShiftAtSince", { job: job.name, time: formatTime(start) }) : t("home.onShiftSince", { time: formatTime(start) })}
        </Text>
        <Text className="text-5xl text-accent-foreground" style={{ fontVariant: ["tabular-nums"] }}>
          {formatDuration(Math.floor(elapsedSeconds / 60))}
          <Text className="text-2xl text-accent-foreground">:{String(elapsedSeconds % 60).padStart(2, "0")}</Text>
        </Text>
      </Pressable>
      <Pressable
        accessibilityLabel={t("home.clockOut")}
        accessibilityRole="button"
        className="size-14 items-center justify-center rounded-full bg-accent-foreground active:opacity-80"
        onPress={onToggle}
      >
        <FilledIcon name="stop" size={30} tone="accent" weight={600} />
      </Pressable>
    </Panel>
  );
}
