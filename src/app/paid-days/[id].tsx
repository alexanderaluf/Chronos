import { useLocalSearchParams } from "expo-router";

import { EditPaidDayScreen } from "@/features/paid-days/paid-day-form-screen";

export default function EditPaidDayRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <EditPaidDayScreen id={id} />;
}
