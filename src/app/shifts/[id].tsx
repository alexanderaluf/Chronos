import { useLocalSearchParams } from "expo-router";

import { EditShiftScreen } from "@/features/shifts/shift-form-screen";

export default function EditShiftRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <EditShiftScreen id={id} />;
}
