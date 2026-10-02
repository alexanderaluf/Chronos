import type { PropsWithChildren, ReactNode } from "react";
import { View } from "react-native";
import { useTranslation } from "react-i18next";

import { useAppLocalization } from "@/localization/localization-provider";

import { Text, useTextAlignment } from "./app-text";

/** A titled block on a tab page. */
export function Section({ title, action, children }: PropsWithChildren<{ title?: string; action?: ReactNode }>) {
  return (
    <View className="gap-3">
      {title || action ? (
        <View className="flex-row items-center justify-between">
          {title ? (
            <Text accessibilityRole="header" className="text-base text-muted">
              {title}
            </Text>
          ) : null}
          {action}
        </View>
      ) : null}
      {children}
    </View>
  );
}

/** A rounded surface card. */
export function Panel({ children, className }: PropsWithChildren<{ className?: string }>) {
  return <View className={`rounded-3xl bg-surface p-5 ${className ?? ""}`}>{children}</View>;
}

/** One label / value line inside a panel. */
export function ValueRow({ label, value, emphasis, note, className, valueClassName, valueDirection }: {
  label: string;
  value: string;
  emphasis?: boolean;
  note?: string;
  className?: string;
  valueClassName?: string;
  valueDirection?: "ltr";
}) {
  const { direction } = useAppLocalization();
  const preferredAlignment = useTextAlignment();
  return (
    <View className={`flex-row items-center justify-between gap-4 py-1.5 ${className ?? ""}`} style={{ direction: preferredAlignment ? preferredAlignment === "right" ? "rtl" : "ltr" : direction }}>
      <View className="min-w-0 flex-1 items-start gap-1">
        <Text className={emphasis ? "font-manrope-semibold text-base" : "text-sm text-muted"}>{label}</Text>
        {note ? <Text className="text-xs leading-4 text-muted">{note}</Text> : null}
      </View>
      <View className="max-w-[48%] shrink items-end">
        <Text className={`${emphasis ? "font-manrope-semibold text-base" : "text-sm"} ${valueClassName ?? ""}`} style={{ fontVariant: ["tabular-nums"], ...(valueDirection ? { writingDirection: valueDirection } : {}), ...(preferredAlignment ? { textAlign: preferredAlignment === "right" ? "left" as const : "right" as const } : {}) }}>
          {value}
        </Text>
      </View>
    </View>
  );
}

/** Shown while a live query loads, or when it fails. */
export function QueryState({ error, errorText }: { error?: Error; errorText?: string }) {
  const { t } = useTranslation();
  return (
    <Panel>
      <Text className={error ? "text-danger" : "text-muted"}>{error ? errorText ?? error.message : t("common.loading")}</Text>
    </Panel>
  );
}
