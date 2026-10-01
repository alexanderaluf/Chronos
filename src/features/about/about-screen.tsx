import Constants from "expo-constants";
import { useTranslation } from "react-i18next";

import { Text } from "@/shared/ui/app-text";
import { FieldRow, FormSection } from "@/shared/ui/form/fields";
import { FormScreen } from "@/shared/ui/form/form-screen";

/** Route: /about */
export function AboutScreen() {
  const { t } = useTranslation();
  const privacy = t("about.privacyPoints", { returnObjects: true });
  const important = t("about.importantPoints", { returnObjects: true });

  return (
    <FormScreen title={t("about.title")}>
      <FormSection title="Chronos">
        <FieldRow label={t("about.version")}>
          <Text className="text-muted">{Constants.expoConfig?.version ?? "1.0.0"}</Text>
        </FieldRow>
      </FormSection>
      <FormSection title={t("about.privacy")}>
        {privacy.map((point) => (
          <Text key={point} className="border-b-2 border-background px-4 py-3 text-sm">
            {point}
          </Text>
        ))}
      </FormSection>
      <FormSection title={t("about.important")}>
        {important.map((point) => (
          <Text key={point} className="border-b-2 border-background px-4 py-3 text-sm">
            {point}
          </Text>
        ))}
      </FormSection>
    </FormScreen>
  );
}
