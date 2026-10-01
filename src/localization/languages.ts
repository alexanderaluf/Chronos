import { APP_LANGUAGES, type AppLanguage } from "@/domain/entities";

export { APP_LANGUAGES, type AppLanguage };

export type LanguageOption = {
  code: AppLanguage;
  direction: "ltr" | "rtl";
  /** The language's name in itself — never translated. */
  nativeName: string;
};

export const LANGUAGE_OPTIONS: readonly LanguageOption[] = [
  { code: "en", direction: "ltr", nativeName: "English" },
  { code: "he", direction: "rtl", nativeName: "עברית" },
  { code: "ru", direction: "ltr", nativeName: "Русский" },
];

export function isAppLanguage(value: unknown): value is AppLanguage {
  return APP_LANGUAGES.includes(value as AppLanguage);
}

export function isRtlLanguage(language: AppLanguage): boolean {
  return language === "he";
}
