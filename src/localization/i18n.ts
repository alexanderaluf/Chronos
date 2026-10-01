import { createInstance } from "i18next";
import { initReactI18next } from "react-i18next";

import { APP_LANGUAGES } from "./languages";
import { en } from "./locales/en";
import { he } from "./locales/he";
import { ru } from "./locales/ru";

/**
 * The app's i18next instance (same setup as Plutus). Components use
 * `useTranslation()`; non-React code (formatters, error messages) uses `i18n.t`.
 * The active language is applied by `LocalizationProvider`.
 */
export const i18n = createInstance();

void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    he: { translation: he },
    ru: { translation: ru },
  },
  lng: "en",
  fallbackLng: "en",
  supportedLngs: [...APP_LANGUAGES],
  interpolation: { escapeValue: false },
  returnNull: false,
});
