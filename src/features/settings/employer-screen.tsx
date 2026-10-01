import { useSQLiteContext } from "expo-sqlite";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useSettings } from "@/data/hooks/queries";
import { updateSettings } from "@/data/repositories/settings-repository";
import type { AppSettings } from "@/domain/entities";
import { FormSection, TextField } from "@/shared/ui/form/fields";
import { FormScreen } from "@/shared/ui/form/form-screen";
import { QueryGate } from "@/shared/ui/query-gate";
import { i18n } from "@/localization/i18n";

function EmployerForm({ settings }: { settings: AppSettings }) {
  const { t } = useTranslation();
  const database = useSQLiteContext();
  const [name, setName] = useState(settings.employer.name);
  const [email, setEmail] = useState(settings.employer.email);
  const [notes, setNotes] = useState(settings.employer.notes);

  return (
    <FormScreen
      intro={t("employer.intro")}
      title={t("employer.title")}
      onSave={() => updateSettings(database, { employer: { name: name.trim(), email: email.trim(), notes } })}
    >
      <FormSection>
        <TextField label={t("employer.name")} value={name} onChangeText={setName} />
        <TextField keyboardType="email-address" label={t("employer.email")} placeholder={t("employer.emailPlaceholder")} value={email} onChangeText={setEmail} />
        <TextField multiline label={t("employer.notes")} placeholder={t("employer.notesPlaceholder")} value={notes} onChangeText={setNotes} />
      </FormSection>
    </FormScreen>
  );
}

/** Route: /settings/employer */
export function EmployerScreen() {
  const settings = useSettings();
  return <QueryGate query={settings} title={i18n.t("employer.title")}>{(data) => <EmployerForm settings={data} />}</QueryGate>;
}
