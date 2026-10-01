import { useLocalSearchParams } from "expo-router";

import { EditShiftTemplateScreen } from "@/features/settings/shift-templates-screens";

export default function EditShiftTemplateRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <EditShiftTemplateScreen id={id} />;
}
