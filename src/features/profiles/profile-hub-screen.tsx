import { router } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useTranslation } from "react-i18next";
import { Pressable, View } from "react-native";
import Animated, { Easing, FadeInDown, ReduceMotion } from "react-native-reanimated";

import { useActiveJob, useProfiles } from "@/data/hooks/queries";
import { selectProfile, type ProfileSummary } from "@/data/repositories/profiles-repository";
import { errorMessage } from "@/localization/errors";
import { Text } from "@/shared/ui/app-text";
import { FilledIcon } from "@/shared/ui/filled-icon";
import { FormButton, FormSection, LinkRow } from "@/shared/ui/form/fields";
import { FormScreen } from "@/shared/ui/form/form-screen";
import { AppAlert } from "@/shared/ui/overlay/app-alert";
import { ProfileAvatar } from "@/shared/ui/profile-avatar";
import { QueryGate } from "@/shared/ui/query-gate";

import { usePayLabel } from "./pay-label";

const reveal = (index: number) =>
  FadeInDown.delay(index * 90).duration(380).easing(Easing.bezier(0.22, 1, 0.36, 1)).reduceMotion(ReduceMotion.System);

/** One job in the switcher: avatar, name, pay; the active one is marked. */
export function ProfileRow({ profile, active, onPress }: { profile: ProfileSummary; active: boolean; onPress: () => void }) {
  const { t } = useTranslation();
  const payLabel = usePayLabel();
  const { job, shiftCount } = profile;
  return (
    <Pressable
      accessibilityLabel={job.name}
      accessibilityRole="radio"
      accessibilityState={{ checked: active }}
      className="min-h-19 flex-row items-center gap-3 border-b-2 border-background px-4 py-3"
      style={({ pressed }) => ({ opacity: pressed ? 0.72 : 1 })}
      onPress={onPress}
    >
      <ProfileAvatar color={job.color} name={job.name} size={44} />
      <View className="min-w-0 flex-1">
        <Text className="font-manrope-semibold text-[17px] leading-6 text-foreground" numberOfLines={1}>{job.name}</Text>
        <Text className="font-sans text-sm text-muted" numberOfLines={1}>
          {`${payLabel(job)} · ${t("profiles.shifts", { count: shiftCount })}`}
        </Text>
      </View>
      {active ? (
        <View className="flex-row items-center gap-1 rounded-full bg-accent/15 px-2.5 py-1">
          <FilledIcon name="check" size={14} tone="accent" />
          <Text className="font-manrope-semibold text-xs text-accent">{t("profiles.active")}</Text>
        </View>
      ) : (
        <FilledIcon name="chevron-right" size={22} tone="muted" />
      )}
    </Pressable>
  );
}

function ProfileHub({ profiles, activeId }: { profiles: ProfileSummary[]; activeId: string }) {
  const { t } = useTranslation();
  const database = useSQLiteContext();
  const payLabel = usePayLabel();
  const active = profiles.find((profile) => profile.job.id === activeId) ?? profiles[0];

  async function switchTo(jobId: string) {
    if (jobId === activeId) return;
    try {
      await selectProfile(database, jobId);
      // Back to the tab, which now shows the chosen job.
      if (router.canGoBack()) router.back();
    } catch (error) {
      AppAlert.alert(t("common.couldNotSave"), errorMessage(error));
    }
  }

  return (
    <FormScreen title={t("profiles.hubTitle")}>
      <Animated.View entering={reveal(0)} className="items-center gap-2 pt-2">
        <ProfileAvatar color={active.job.color} name={active.job.name} size={84} />
        <Text accessibilityRole="header" className="mt-3 text-center font-manrope-bold text-[26px] text-foreground">
          {active.job.name}
        </Text>
        <Text className="text-center font-sans text-sm text-muted">
          {`${payLabel(active.job)} · ${t("profiles.shifts", { count: active.shiftCount })}`}
        </Text>
        <View className="mt-3">
          <FormButton icon="edit-note" label={t("profiles.editProfile")} tone="neutral" onPress={() => router.push(`/profile/${active.job.id}`)} />
        </View>
      </Animated.View>

      {profiles.length > 1 ? (
        <Animated.View entering={reveal(1)}>
          <FormSection description={t("profiles.switchHint")} title={t("profiles.switchTitle")}>
            {profiles.map((profile) => (
              <ProfileRow key={profile.job.id} active={profile.job.id === activeId} profile={profile} onPress={() => void switchTo(profile.job.id)} />
            ))}
          </FormSection>
        </Animated.View>
      ) : null}

      <Animated.View entering={reveal(2)}>
        <FormSection>
          <LinkRow hint={t("profiles.addProfileHint")} icon="add" iconBackground="#9bd59b" label={t("profiles.addProfile")} onPress={() => router.push("/profile/new")} />
          <LinkRow icon="work" iconBackground="#ca79da" label={t("profiles.manageProfiles")} onPress={() => router.push("/profile/manage")} />
        </FormSection>
      </Animated.View>
    </FormScreen>
  );
}

/** Route: /profile — the profile button's page: the active job, the job switcher, add and manage jobs. */
export function ProfileHubScreen() {
  const { t } = useTranslation();
  const profiles = useProfiles();
  const job = useActiveJob();
  return (
    <QueryGate query={profiles} title={t("profiles.hubTitle")}>
      {(data) => (data.length > 0 ? <ProfileHub activeId={job.data?.id ?? data[0].job.id} profiles={data} /> : null)}
    </QueryGate>
  );
}
