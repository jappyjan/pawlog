import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next } from "react-i18next";
import { de as dfDe, enGB as dfEn } from "date-fns/locale";
import { en } from "./en";
import { de } from "./de";

export const LANGS = ["en", "de"] as const;
export type Lang = (typeof LANGS)[number];
export const LANG_KEY = "pawlog:lang";

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: { en: { translation: en }, de: { translation: de } },
    supportedLngs: LANGS,
    nonExplicitSupportedLngs: true, // de-AT, de-CH → de
    load: "languageOnly",
    fallbackLng: "en",
    interpolation: { escapeValue: false }, // React escapes
    detection: {
      order: ["localStorage", "navigator"],
      lookupLocalStorage: LANG_KEY,
      caches: [], // only remember an explicit choice (see setLanguage)
    },
  });

const syncHtml = (l: string) => document.documentElement.setAttribute("lang", l);
syncHtml(i18n.resolvedLanguage ?? "en");
i18n.on("languageChanged", syncHtml);

export const lang = (): Lang => (i18n.resolvedLanguage === "de" ? "de" : "en");
export const dateLocale = () => (lang() === "de" ? dfDe : dfEn);

/** null = follow the browser language. */
export function setLanguage(l: Lang | null) {
  try {
    if (l) localStorage.setItem(LANG_KEY, l);
    else localStorage.removeItem(LANG_KEY);
  } catch {
    /* private mode */
  }
  void i18n.changeLanguage(l ?? undefined);
}

export function chosenLanguage(): Lang | null {
  try {
    const v = localStorage.getItem(LANG_KEY);
    return v === "en" || v === "de" ? v : null;
  } catch {
    return null;
  }
}

export default i18n;
