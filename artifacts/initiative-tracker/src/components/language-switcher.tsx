import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { useUpdateSettings, getGetSettingsQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import type { AppLanguage } from "@/i18n";

export function LanguageSwitcher() {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const current = i18n.language.startsWith("ja") ? "ja" : "en";

  const updateMutation = useUpdateSettings({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetSettingsQueryKey() });
      },
      onError: (_error, variables) => {
        // Server save failed: revert the optimistic switch so the UI does not
        // drift from the saved preference.
        const previous: AppLanguage = variables.data.language === "ja" ? "en" : "ja";
        i18n.changeLanguage(previous);
      },
    },
  });

  const setLanguage = (language: AppLanguage) => {
    if (language === current) return;
    i18n.changeLanguage(language);
    updateMutation.mutate({ data: { language } });
  };

  return (
    <div
      className="flex items-center gap-0.5 rounded-md border p-0.5"
      role="group"
      aria-label={t("language.label")}
    >
      <Button
        type="button"
        variant={current === "en" ? "secondary" : "ghost"}
        size="sm"
        className="h-7 px-2 text-xs"
        aria-pressed={current === "en"}
        onClick={() => setLanguage("en")}
      >
        EN
      </Button>
      <Button
        type="button"
        variant={current === "ja" ? "secondary" : "ghost"}
        size="sm"
        className="h-7 px-2 text-xs"
        aria-pressed={current === "ja"}
        onClick={() => setLanguage("ja")}
      >
        日本語
      </Button>
    </div>
  );
}
