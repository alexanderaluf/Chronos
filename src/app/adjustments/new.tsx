import { useLocalSearchParams } from "expo-router";

import { NewAdjustmentScreen } from "@/features/adjustments/adjustments-screens";

export default function NewAdjustmentRoute() {
  const { period, kind } = useLocalSearchParams<{ period: string; kind?: string }>();
  return <NewAdjustmentScreen kind={kind} period={period} />;
}
