import { router } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useTranslation } from "react-i18next";
import { Pressable, View } from "react-native";

import { useActiveJob, useProfiles } from "@/data/hooks/queries";
import { selectProfile, type ProfileSummary } from "@/data/repositories/profiles-repository";
import { errorMessage } from "@/localization/errors";
import { Text } from "@/shared/ui/app-text";
import { FilledIcon, type FilledIconName } from "@/shared/ui/filled-icon";
import { AddRow, FormSection } from "@/shared/ui/form/fields";
import { FormScreen } from "@/shared/ui/form/form-screen";
import { AppAlert } from "@/shared/ui/overlay/app-alert";
import { ProfileAvatar } from "@/shared/ui/profile-avatar";
import { QueryGate } from "@/shared/ui/query-gate";

import { confirmDeleteProfile } from "./delete-profile";
import { usePayLabel } from "./pay-label";

function IconButton({ icon, label, tone, onPress }: { icon: FilledIconName; label: string; tone: "muted" | "danger"; onPress: () => void }) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      className="size-10 items-center justify-center rounded-full"
      hitSlop={4}
      style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
      onPress={onPress}
    >
      <FilledIcon name={icon} size={20} tone={tone} />
    </Pressable>
  );
}

/** The Plutus profile card: avatar, name, pay and currency, shift count, edit and delete. */
function ProfileCard({ profile, active, canDelete, onSelect, onDelete }: {
  profile: ProfileSummary;
  active: boolean;
  canDelete: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  const payLabel = usePayLabel();
  const { job, shiftCount } = profile;
  return (
    <Pressable
      accessibilityLabel={job.name}
      accessibilityRole="radio"
      accessibilityState={{ checked: active }}
      className={`gap-3 rounded-[28px] border bg-surface p-4 ${active ? "border-accent" : "border-transparent"}`}
      style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
      onPress={onSelect}
    >
      <View className="flex-row items-center gap-3">
        <ProfileAvatar color={job.color} name={job.name} size={48} />
        <View className="min-w-0 flex-1">
          <Text className="font-manrope-bold text-base text-foreground" numberOfLines={1}>{job.name}</Text>
          <Text className="mt-0.5 font-sans text-sm text-muted" numberOfLines={1}>{`${payLabel(job)} · ${job.currencyCode}`}</Text>
        </View>
        {active ? (
          <View className="flex-row items-center gap-1 rounded-full bg-accent/15 px-2.5 py-1">
            <FilledIcon name="check" size={14} tone="accent" />
            <Text className="font-manrope-semibold text-xs text-accent">{t("profiles.active")}</Text>
          </View>
        ) : null}
      </View>
      <View className="flex-row items-center justify-between border-t border-border pt-2">
        <Text className="font-sans text-xs text-muted">{t("profiles.shifts", { count: shiftCount })}</Text>
        <View className="flex-row items-center">
          <IconButton icon="edit-note" label={t("profiles.edit", { name: job.name })} tone="muted" onPress={() => router.push(`/profile/${job.id}`)} />
          {canDelete ? <IconButton icon="delete" label={t("profiles.delete", { name: job.name })} tone="danger" onPress={onDelete} /> : null}
        </View>
      </View>
    </Pressable>
  );
}

function ManageProfiles({ profiles, activeId }: { profiles: ProfileSummary[]; activeId: string | null }) {
  const { t } = useTranslation();
  const database = useSQLiteContext();

  async function select(jobId: string) {
    if (jobId === activeId) return;
    try {
      await selectProfile(database, jobId);
    } catch (error) {
      AppAlert.alert(t("common.couldNotSave"), errorMessage(error));
    }
  }

  return (
    <FormScreen intro={t("profiles.manageDescription")} title={t("profiles.manageTitle")}>
      <View className="gap-3">
        {profiles.map((profile) => (
          <ProfileCard
            key={profile.job.id}
            active={profile.job.id === activeId}
            canDelete={profiles.length > 1}
            profile={profile}
            onDelete={() => void confirmDeleteProfile(database, profile.job)}
            onSelect={() => void select(profile.job.id)}
          />
        ))}
      </View>
      <FormSection>
        <AddRow label={t("profiles.addProfile")} onPress={() => router.push("/profile/new")} />
      </FormSection>
    </FormScreen>
  );
}

/** Route: /profile/manage — every job profile: switch, edit, delete, add. */
export function ManageProfilesScreen() {
  const { t } = useTranslation();
  const profiles = useProfiles();
  const job = useActiveJob();
  return (
    <QueryGate query={profiles} title={t("profiles.manageTitle")}>
      {(data) => <ManageProfiles activeId={job.data?.id ?? null} profiles={data} />}
    </QueryGate>
  );
}
