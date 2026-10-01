import { useLocalSearchParams } from "expo-router";

import { NewShiftScreen } from "@/features/shifts/shift-form-screen";

export default function NewShiftRoute() {
  const { date, templateId } = useLocalSearchParams<{ date?: string; templateId?: string }>();
  return <NewShiftScreen date={date} templateId={templateId} />;
}
