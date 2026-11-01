import type { SQLiteDatabase } from "expo-sqlite";

import { deleteProfile } from "@/data/repositories/profiles-repository";
import type { Job } from "@/domain/entities";
import { errorMessage } from "@/localization/errors";
import { i18n } from "@/localization/i18n";
import { AppAlert } from "@/shared/ui/overlay/app-alert";

/** Asks before deleting a job profile; resolves `true` once it is deleted. */
export async function confirmDeleteProfile(database: SQLiteDatabase, job: Job): Promise<boolean> {
  const confirmed = await AppAlert.ask(
    i18n.t("profiles.deleteTitle", { name: job.name }),
    i18n.t("profiles.deleteMessage"),
    [{ text: i18n.t("profiles.deleteConfirm"), value: true }],
    i18n.t("common.cancel"),
  );
  if (!confirmed) return false;
  try {
    await deleteProfile(database, job.id);
    return true;
  } catch (error) {
    AppAlert.alert(i18n.t("profiles.deleteFailed"), errorMessage(error));
    return false;
  }
}
