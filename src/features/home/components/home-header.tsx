import { useTranslation } from "react-i18next";
import { View } from "react-native";

import { useNow } from "@/features/shifts/hooks/use-now";
import { getAppLocale } from "@/shared/lib/format";
import { Text } from "@/shared/ui/app-text";

function greetingKey(hour: number) {
  if (hour < 5) return "night" as const;
  if (hour < 12) return "morning" as const;
  if (hour < 18) return "afternoon" as const;
  return "evening" as const;
}

/** Today's date and a time-of-day greeting. */
export function HomeHeader() {
  const { t } = useTranslation();
  const now = useNow(60_000);

  return (
    <View className="pt-3">
      <Text className="font-manrope-medium text-xs uppercase tracking-widest text-muted">
        {now.toLocaleDateString(getAppLocale(), { weekday: "long", day: "numeric", month: "long" })}
      </Text>
      <Text accessibilityRole="header" className="mt-1 font-manrope-bold text-2xl text-foreground">
        {t(`home.greetings.${greetingKey(now.getHours())}`)}
      </Text>
    </View>
  );
}
