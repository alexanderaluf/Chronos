import { useTranslation } from "react-i18next";
import { Pressable, View } from "react-native";

import { useAppLocalization } from "@/localization/localization-provider";

import { Text } from "./app-text";
import { ProfileAvatar } from "./profile-avatar";

/**
 * The header above every tab: the active job's name and the profile button
 * (the job's avatar) that opens the profile hub, as in Plutus. The tab shell
 * renders it once, so it stays in place while the user switches tabs.
 */
export function TabHeader({
  profile,
  onOpenProfile,
}: {
  /** The active job; the header stays empty until it has loaded. */
  profile: { name: string; color: string } | null | undefined;
  onOpenProfile: () => void;
}) {
  const { t } = useTranslation();
  const { direction } = useAppLocalization();
  // The header sits outside the tab screens, so it takes the reading direction itself.
  return (
    <View className="min-h-11 flex-row items-center gap-3 px-5" style={{ direction }}>
      <View className="min-w-0 flex-1">
        {profile ? (
          <Text className="font-manrope-medium text-xs uppercase tracking-widest text-muted" numberOfLines={1}>
            {profile.name}
          </Text>
        ) : null}
      </View>
      {profile ? (
        <Pressable
          accessibilityHint={profile.name}
          accessibilityLabel={t("profiles.open")}
          accessibilityRole="button"
          hitSlop={6}
          style={({ pressed }) => ({ opacity: pressed ? 0.68 : 1 })}
          onPress={onOpenProfile}
        >
          <ProfileAvatar color={profile.color} name={profile.name} size={42} />
        </Pressable>
      ) : null}
    </View>
  );
}
