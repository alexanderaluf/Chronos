import { useState } from "react";

import { CreateMenuSheet } from "@/features/create-menu/create-menu-sheet";
import { TabShell } from "@/shared/navigation/tab-shell";

import { useTabActions } from "./use-tab-actions";

/** The four tabs, their action button, and the "+" menu sheet. */
export function MainTabs() {
  const [isCreateMenuOpen, setCreateMenuOpen] = useState(false);
  const actions = useTabActions({ openCreateMenu: () => setCreateMenuOpen(true) });

  return (
    <>
      <TabShell actions={actions} />
      <CreateMenuSheet isOpen={isCreateMenuOpen} onClose={() => setCreateMenuOpen(false)} />
    </>
  );
}
