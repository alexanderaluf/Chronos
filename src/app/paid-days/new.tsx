import { useLocalSearchParams } from "expo-router";

import { NewPaidDayScreen } from "@/features/paid-days/paid-day-form-screen";

export default function NewPaidDayRoute() {
  const { date } = useLocalSearchParams<{ date?: string }>();
  return <NewPaidDayScreen date={date} />;
}
