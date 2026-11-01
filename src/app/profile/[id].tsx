import { useLocalSearchParams } from "expo-router";

import { EditProfileScreen } from "@/features/profiles/profile-editor-screen";

export default function EditProfileRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <EditProfileScreen id={id} />;
}
