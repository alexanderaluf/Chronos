import { useTranslation } from "react-i18next";

import { Text } from "./app-text";

type Status = "ready" | "disabled" | "needsLocation" | "unavailable" | "missingTimes";

/** Explain estimates that could not include a verified holiday calendar. */
export function HolidayPayNotice({ status }: { status?: Status }) {
  const { t } = useTranslation();
  if (!status || status === "ready" || status === "disabled") return null;
  return <Text accessibilityRole="alert" className="px-1 text-sm leading-5 text-warning">{t(`holidayPay.status.${status}`)}</Text>;
}
