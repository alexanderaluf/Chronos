import { Avatar } from "heroui-native";
import { useTranslation } from "react-i18next";

import { readableTextOn } from "@/shared/theme/app-theme";

/** "Café Aroma" → "CA", "bar" → "B". */
export function profileInitials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

/**
 * A job profile's avatar: its initials on its color (the Plutus profile
 * avatar). HeroUI Avatar, the same on iOS and Android.
 */
export function ProfileAvatar({ name, color, size = 40 }: { name: string; color: string; size?: number }) {
  const { t } = useTranslation();
  return (
    <Avatar
      accessibilityLabel={t("profiles.avatar", { name })}
      color="accent"
      size={size >= 64 ? "lg" : "md"}
      className="rounded-full"
      style={{ backgroundColor: color, borderRadius: size / 2, height: size, width: size, overflow: "hidden" }}
    >
      <Avatar.Fallback
        textProps={{
          allowFontScaling: false,
          style: { color: readableTextOn(color), fontFamily: "Huninn_400Regular", fontSize: Math.round(size * 0.38) },
        }}
      >
        {profileInitials(name)}
      </Avatar.Fallback>
    </Avatar>
  );
}
