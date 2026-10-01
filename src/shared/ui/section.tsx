import type { PropsWithChildren, ReactNode } from "react";
import { View } from "react-native";
import { useTranslation } from "react-i18next";

import { Text } from "./app-text";

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
export function ValueRow({ label, value, emphasis }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <View className="flex-row items-center justify-between py-1.5">
      <Text className={emphasis ? "text-base" : "text-sm text-muted"}>{label}</Text>
      <Text className={emphasis ? "text-base" : "text-sm"} style={{ fontVariant: ["tabular-nums"] }}>
        {value}
      </Text>
    </View>
  );
}

/** Shown while a live query loads, or when it fails. */
export function QueryState({ error }: { error?: Error }) {
  const { t } = useTranslation();
  return (
    <Panel>
      <Text className={error ? "text-danger" : "text-muted"}>{error ? error.message : t("common.loading")}</Text>
    </Panel>
  );
}
