import { router, type Href } from "expo-router";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, View } from "react-native";

import { useShiftTemplates } from "@/data/hooks/queries";
import { formatMinuteOfDay } from "@/domain/time/time";
import { Text } from "@/shared/ui/app-text";
import { FilledIcon, type FilledIconName } from "@/shared/ui/filled-icon";
import { AppBottomSheet } from "@/shared/ui/overlay/app-bottom-sheet";

function MenuButton({
  icon,
  label,
  hint,
  emphasis,
  onPress,
}: {
  icon: FilledIconName;
  label: string;
  hint?: string;
  emphasis?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      className={`flex-row items-center gap-4 rounded-2xl px-5 py-4 active:opacity-80 ${emphasis ? "bg-accent" : "bg-background"}`}
      onPress={onPress}
    >
      <FilledIcon name={icon} size={26} tone={emphasis ? "accent-foreground" : "accent"} />
      <View className="flex-1">
        <Text className={`text-lg ${emphasis ? "text-accent-foreground" : ""}`}>{label}</Text>
        {hint ? <Text className={`text-xs ${emphasis ? "text-accent-foreground/80" : "text-muted"}`}>{hint}</Text> : null}
      </View>
    </Pressable>
  );
}

/**
 * The "+" menu on Home: what can be added. A bottom sheet — native SwiftUI on
 * iOS, the app's own sheet on Android (see AppBottomSheet).
 * Navigation waits until the sheet has fully closed.
 */
export function CreateMenuSheet({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const templates = useShiftTemplates();
  const [showTemplates, setShowTemplates] = useState(false);
  const pending = useRef<Href | null>(null);
  const templateList = templates.data ?? [];

  function go(href: Href) {
    pending.current = href;
    onClose();
  }

  return (
    <AppBottomSheet
      isOpen={isOpen}
      onClose={onClose}
      onDismissed={() => {
        setShowTemplates(false);
        const href = pending.current;
        pending.current = null;
        if (href) router.push(href);
      }}
    >
      <View className="gap-3 px-4 pb-4">
        <Text accessibilityRole="header" className="px-1 pb-1 font-manrope-bold text-xl">
          {t("createMenu.title")}
        </Text>
        <MenuButton emphasis hint={t("createMenu.newShiftHint")} icon="edit-calendar" label={t("createMenu.newShift")} onPress={() => go("/shifts/new")} />
        <MenuButton
          hint={templateList.length ? t("createMenu.fixedShiftPick") : t("createMenu.fixedShiftCreate")}
          icon="repeat"
          label={t("createMenu.fixedShift")}
          onPress={() => (templateList.length ? setShowTemplates((value) => !value) : go("/settings/templates/new"))}
        />
        {showTemplates ? (
          <View className="gap-2 ps-6">
            {templateList.map((template) => (
              <Pressable
                key={template.id}
                accessibilityRole="button"
                className="flex-row items-center gap-3 rounded-xl bg-background px-4 py-3 active:opacity-80"
                onPress={() => go({ pathname: "/shifts/new", params: { templateId: template.id } })}
              >
                <View className="size-3 rounded-full" style={{ backgroundColor: template.color }} />
                <Text className="flex-1 text-base">{template.name}</Text>
                <Text className="text-sm text-muted">
                  {template.startMinute !== null && template.endMinute !== null
                    ? `${formatMinuteOfDay(template.startMinute)}–${formatMinuteOfDay(template.endMinute)}`
                    : t("createMenu.variableHours")}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}
        <MenuButton hint={t("createMenu.paidDayHint")} icon="beach" label={t("createMenu.paidDay")} onPress={() => go("/paid-days/new")} />
        <MenuButton
          hint={t("createMenu.monthlyAdditionsHint")}
          icon="savings"
          label={t("createMenu.monthlyAdditions")}
          onPress={() => go("/adjustments")}
        />
      </View>
    </AppBottomSheet>
  );
}
