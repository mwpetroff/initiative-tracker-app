import { useEffect, useRef } from "react";
import { useGetSettings } from "@workspace/api-client-react";
import i18n, { type AppLanguage } from "@/i18n";

// Applies the server-saved language preference once on app load, so the app
// opens in the saved language on any device. After that, the user's in-session
// choice (via the language switcher) takes precedence.
export function LanguageSync() {
  const { data: settings } = useGetSettings();
  const applied = useRef(false);

  useEffect(() => {
    if (!settings || applied.current) return;
    applied.current = true;

    const serverLanguage = settings.language as AppLanguage;
    const current: AppLanguage = i18n.language.startsWith("ja") ? "ja" : "en";
    if (serverLanguage !== current) {
      i18n.changeLanguage(serverLanguage);
    }
  }, [settings]);

  return null;
}
