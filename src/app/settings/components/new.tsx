import { useLocalSearchParams } from "expo-router";

import { NewPayComponentScreen } from "@/features/settings/pay-components-screens";

export default function NewPayComponentRoute() {
  const { kind } = useLocalSearchParams<{ kind?: string }>();
  return <NewPayComponentScreen kind={kind === "deduction" ? "deduction" : "addition"} />;
}
