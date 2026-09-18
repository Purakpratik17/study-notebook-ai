/* ═══════════════════════════════════════════════════════════════════════
   Cerevyn languages — single registry for the launch set. To add a
   language later: append one entry here and (optionally) one translations
   block in src/lib/i18n.ts. Everything downstream reads from these lists.
   ═══════════════════════════════════════════════════════════════════════ */

export type LanguageCode =
  | "en" | "es" | "zh" | "fr" | "ar" | "bn" | "pt" | "ru" | "ja" | "de"
  | "ko" | "it" | "tr" | "hi" | "vi" | "id" | "pl" | "nl" | "th" | "uk";

export type LanguageDef = {
  code: LanguageCode;
  name: string; // English name (Settings list)
  native: string; // native name shown in the selector
};

export const LANGUAGES: LanguageDef[] = [
  { code: "en", name: "English", native: "English" },
  { code: "es", name: "Spanish", native: "Español" },
  { code: "zh", name: "Chinese (Simplified)", native: "中文" },
  { code: "fr", name: "French", native: "Français" },
  { code: "ar", name: "Arabic", native: "العربية" },
  { code: "bn", name: "Bengali", native: "বাংলা" },
  { code: "pt", name: "Portuguese", native: "Português" },
  { code: "ru", name: "Russian", native: "Русский" },
  { code: "ja", name: "Japanese", native: "日本語" },
  { code: "de", name: "German", native: "Deutsch" },
  { code: "ko", name: "Korean", native: "한국어" },
  { code: "it", name: "Italian", native: "Italiano" },
  { code: "tr", name: "Turkish", native: "Türkçe" },
  { code: "hi", name: "Hindi", native: "हिन्दी" },
  { code: "vi", name: "Vietnamese", native: "Tiếng Việt" },
  { code: "id", name: "Indonesian", native: "Bahasa Indonesia" },
  { code: "pl", name: "Polish", native: "Polski" },
  { code: "nl", name: "Dutch", native: "Nederlands" },
  { code: "th", name: "Thai", native: "ไทย" },
  { code: "uk", name: "Ukrainian", native: "Українська" },
];

export const DEFAULT_LANGUAGE: LanguageCode = "en";

export function languageByCode(code: string): LanguageDef {
  return LANGUAGES.find((l) => l.code === code) ?? LANGUAGES[0];
}
