import { router } from "expo-router";
import { useState } from "react";

import { useActiveJob } from "@/data/hooks/queries";

import { CreateMenuSheet } from "@/features/create-menu/create-menu-sheet";
import { TabShell } from "@/shared/navigation/tab-shell";
import { TabHeader } from "@/shared/ui/tab-header";

import { useTabActions } from "./use-tab-actions";

/** The four tabs, the profile header above them, their action button, and the "+" menu sheet. */
export function MainTabs() {
  const [isCreateMenuOpen, setCreateMenuOpen] = useState(false);
  const actions = useTabActions({ openCreateMenu: () => setCreateMenuOpen(true) });
  const job = useActiveJob();

  return (
    <>
      <TabShell actions={actions} header={<TabHeader profile={job.data} onOpenProfile={() => router.push("/profile")} />} />
      <CreateMenuSheet isOpen={isCreateMenuOpen} onClose={() => setCreateMenuOpen(false)} />
    </>
  );
}
