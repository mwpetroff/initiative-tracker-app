import i18n from "i18next";
import { initReactI18next, useTranslation } from "react-i18next";
import en from "./locales/en.json";
import ja from "./locales/ja.json";

export const LANGUAGE_STORAGE_KEY = "initiative-tracker-language";

export type AppLanguage = "en" | "ja";

function getStoredLanguage(): AppLanguage {
  try {
    const value = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (value === "en" || value === "ja") return value;
  } catch {
    // localStorage unavailable (e.g. non-browser environment)
  }
  return "en";
}

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    ja: { translation: ja },
  },
  lng: getStoredLanguage(),
  fallbackLng: "en",
  interpolation: { escapeValue: false },
});

i18n.on("languageChanged", (lng) => {
  try {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, lng);
  } catch {
    // ignore persistence failures
  }
});

export function getDateLocale(lng: string): string {
  return lng.startsWith("ja") ? "ja-JP" : "en-US";
}

export function useDateLocale(): string {
  const { i18n: instance } = useTranslation();
  return getDateLocale(instance.language);
}

export function useQuarterLocale(): AppLanguage {
  const { i18n: instance } = useTranslation();
  return instance.language.startsWith("ja") ? "ja" : "en";
}

export default i18n;
