import { getLocales } from "expo-localization";
import { HeroUINativeProvider } from "heroui-native";
import { createContext, useContext, useEffect, useState, type ComponentType, type PropsWithChildren } from "react";
import { I18nextProvider } from "react-i18next";
import { I18nManager, Platform, View, type ViewProps } from "react-native";
import { LayoutDirection } from "uniwind";

import { useSettings } from "@/data/hooks/queries";

import { i18n } from "./i18n";
import { isAppLanguage, isRtlLanguage, type AppLanguage } from "./languages";

type AppDirection = "ltr" | "rtl";

type LocalizationContextValue = {
  language: AppLanguage;
  direction: AppDirection;
  isRTL: boolean;
};

/** The device language if the app supports it, otherwise English. */
export function getDeviceLanguage(): AppLanguage {
  const code = getLocales()[0]?.languageCode;
  // Older Android versions report Hebrew as "iw".
  const normalized = code === "iw" ? "he" : code;
  return isAppLanguage(normalized) ? normalized : "en";
}

const LocalizationContext = createContext<LocalizationContextValue>({
  language: "en",
  direction: "ltr",
  isRTL: false,
});

const DirectionalView = View as ComponentType<ViewProps & { dir?: AppDirection }>;

/**
 * Applies the app language (Settings → General, or the device language) —
 * the Plutus approach:
 * - i18next switches the strings,
 * - a root `direction` style + Uniwind `LayoutDirection` + HeroUI `isRTL`
 *   flip the whole layout immediately (Hebrew = RTL, English/Russian = LTR),
 * - `I18nManager.forceRTL` makes native views match from the next launch.
 */
export function LocalizationProvider({ children }: PropsWithChildren) {
  const settings = useSettings();
  const language = settings.data?.appLanguage ?? getDeviceLanguage();
  const isRTL = isRtlLanguage(language);
  const direction: AppDirection = isRTL ? "rtl" : "ltr";
  const [readyLanguage, setReadyLanguage] = useState<AppLanguage | null>(
    i18n.resolvedLanguage === language ? language : null,
  );

  useEffect(() => {
    let active = true;
    async function apply() {
      if (i18n.resolvedLanguage !== language) await i18n.changeLanguage(language);
      if (active) setReadyLanguage(language);
      if (Platform.OS !== "web" && I18nManager.isRTL !== isRTL) {
        I18nManager.allowRTL(true);
        I18nManager.swapLeftAndRightInRTL(true);
        I18nManager.forceRTL(isRTL);
      }
    }
    void apply();
    return () => {
      active = false;
    };
  }, [isRTL, language]);

  // Wait for saved settings, so the first frame is already in the right language.
  if (settings.status === "loading" || readyLanguage === null) return null;

  return (
    <I18nextProvider i18n={i18n}>
      <LocalizationContext.Provider value={{ language, direction, isRTL }}>
        <LayoutDirection rtl={isRTL}>
          <HeroUINativeProvider config={{ isRTL }}>
            <DirectionalView dir={direction} style={{ direction, flex: 1 }}>
              {children}
            </DirectionalView>
          </HeroUINativeProvider>
        </LayoutDirection>
      </LocalizationContext.Provider>
    </I18nextProvider>
  );
}

export function useAppLocalization() {
  return useContext(LocalizationContext);
}
