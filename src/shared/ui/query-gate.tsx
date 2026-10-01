import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { LiveQuery } from "@/data/hooks/use-live-query";

import { Text } from "./app-text";
import { AppSpinner } from "./controls/app-spinner";
import { ScreenHeader } from "./controls/screen-header";

/** Full-screen loading / message state for a pushed screen. */
export function LoadingScreen({ title, message }: { title: string; message?: string }) {
  const insets = useSafeAreaInsets();
  return (
    <View className="flex-1 bg-background">
      <View className="px-4" style={{ paddingTop: insets.top }}>
        <ScreenHeader title={title} />
      </View>
      <View className="flex-1 items-center justify-center gap-3 p-8">
        {message ? <Text className="text-center text-muted">{message}</Text> : <AppSpinner />}
      </View>
    </View>
  );
}

/**
 * Renders `children(data)` once a live query has loaded. Forms use it so their
 * state is initialized once, from real saved values.
 */
export function QueryGate<T>({
  query,
  title,
  notFound,
  children,
}: {
  query: LiveQuery<T | null>;
  title: string;
  notFound?: string;
  children: (data: T) => ReactNode;
}) {
  const { t } = useTranslation();
  if (query.data !== undefined && query.data !== null) return <>{children(query.data)}</>;
  return (
    <LoadingScreen message={query.status === "loading" ? undefined : (query.error?.message ?? notFound ?? t("common.notFound"))} title={title} />
  );
}
