import { useState } from "react";
import { useTranslation } from "react-i18next";
import { chosenLanguage, setLanguage, type Lang } from "../i18n";

/** Auto (browser language) / English / Deutsch. */
export function LanguageSwitch({ className = "" }: { className?: string }) {
  const { t } = useTranslation();
  const [choice, setChoice] = useState<Lang | "auto">(chosenLanguage() ?? "auto");
  return (
    <label className={`inline-flex items-center gap-2 text-sm ${className}`}>
      <span className="text-muted">🌐 {t("settings.language")}</span>
      <select
        className="input w-auto py-1.5"
        value={choice}
        onChange={(e) => {
          const v = e.target.value as Lang | "auto";
          setChoice(v);
          setLanguage(v === "auto" ? null : v);
        }}
      >
        <option value="auto">{t("settings.langAuto")}</option>
        <option value="en">English</option>
        <option value="de">Deutsch</option>
      </select>
    </label>
  );
}
