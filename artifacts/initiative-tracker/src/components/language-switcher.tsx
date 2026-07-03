import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";

export function LanguageSwitcher() {
  const { t, i18n } = useTranslation();
  const current = i18n.language.startsWith("ja") ? "ja" : "en";

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
        onClick={() => i18n.changeLanguage("en")}
      >
        EN
      </Button>
      <Button
        type="button"
        variant={current === "ja" ? "secondary" : "ghost"}
        size="sm"
        className="h-7 px-2 text-xs"
        aria-pressed={current === "ja"}
        onClick={() => i18n.changeLanguage("ja")}
      >
        日本語
      </Button>
    </div>
  );
}
