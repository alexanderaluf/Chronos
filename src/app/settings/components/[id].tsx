import { useLocalSearchParams } from "expo-router";

import { EditPayComponentScreen } from "@/features/settings/pay-components-screens";

export default function EditPayComponentRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <EditPayComponentScreen id={id} />;
}
