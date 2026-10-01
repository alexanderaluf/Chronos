import { useLocalSearchParams } from "expo-router";

import { EditAdjustmentScreen } from "@/features/adjustments/adjustments-screens";

export default function EditAdjustmentRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <EditAdjustmentScreen id={id} />;
}
