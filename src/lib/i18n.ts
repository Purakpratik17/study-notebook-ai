import { DEFAULT_LANGUAGE, type LanguageCode } from "./languages";

/* ═══════════════════════════════════════════════════════════════════════
   Cerevyn i18n — static UI strings for the launch languages.

   Any language missing from this map falls back to English, so new
   languages can be added to the registry first and translated
   incrementally. Study content (notes, quizzes, practice) is NOT
   statically translated — it uses the on-demand AI translator.
   ═══════════════════════════════════════════════════════════════════════ */

export const STRINGS: { nav: Record<string,string>; common: Record<string,string>; settings: Record<string,string> } = {
  nav: {
    home: "Home",
    aiStudy: "AI Study",
    practice: "Practice",
    flashcards: "Flashcards",
    revision: "Revision",
    focus: "Focus",
    friends: "Friends",
    quests: "Quests",
    leaderboard: "Leaderboard",
    timetable: "Timetable",
    profile: "Profile",
    settings: "Settings",
    more: "More",
  },
  common: {
    translate: "Translate",
    original: "Show original",
    translating: "Translating…",
    translateFailed: "Translation failed. Please try again.",
    language: "Language",
    search: "Search",
    cancel: "Cancel",
    close: "Close",
    retry: "Retry",
  },
  settings: {
    languageTitle: "🌍 Language",
    languageHint: "Choose your interface and study-translation language.",
  },
};

type Strings = typeof STRINGS;
type StringKey = keyof Strings;

const TRANSLATIONS: Partial<Record<LanguageCode, Partial<Strings>>> = {
  es: {
    nav: {
      home: "Inicio",
      aiStudy: "Estudio IA",
      practice: "Práctica",
      flashcards: "Tarjetas",
      revision: "Repaso",
      focus: "Enfoque",
      friends: "Amigos",
      quests: "Misiones",
      leaderboard: "Clasificación",
      timetable: "Horario",
      profile: "Perfil",
      settings: "Ajustes",
      more: "Más",
    },
    common: {
      translate: "Traducir",
      original: "Mostrar original",
      translating: "Traduciendo…",
      translateFailed: "Error al traducir. Inténtalo de nuevo.",
      language: "Idioma",
      search: "Buscar",
      cancel: "Cancelar",
      close: "Cerrar",
      retry: "Reintentar",
    },
    settings: {
      languageTitle: "🌍 Idioma",
      languageHint: "Elige el idioma de la interfaz y del contenido de estudio.",
    },
  },
  fr: {
    nav: {
      home: "Accueil",
      aiStudy: "Étude IA",
      practice: "Pratique",
      flashcards: "Cartes",
      revision: "Révision",
      focus: "Focus",
      friends: "Amis",
      quests: "Quêtes",
      leaderboard: "Classement",
      timetable: "Emploi du temps",
      profile: "Profil",
      settings: "Paramètres",
      more: "Plus",
    },
    common: {
      translate: "Traduire",
      original: "Afficher l'original",
      translating: "Traduction…",
      translateFailed: "Échec de la traduction. Réessayez.",
      language: "Langue",
      search: "Rechercher",
      cancel: "Annuler",
      close: "Fermer",
      retry: "Réessayer",
    },
    settings: {
      languageTitle: "🌍 Langue",
      languageHint: "Choisis la langue de l'interface et des contenus d'étude.",
    },
  },
  hi: {
    nav: {
      home: "होम",
      aiStudy: "एआई अध्ययन",
      practice: "अभ्यास",
      flashcards: "फ्लैशकार्ड",
      revision: "पुनरावृत्ति",
      focus: "फ़ोकस",
      friends: "दोस्त",
      quests: "क्वेस्ट",
      leaderboard: "लीडरबोर्ड",
      timetable: "समय-सारणी",
      profile: "प्रोफ़ाइल",
      settings: "सेटिंग्स",
      more: "और",
    },
    common: {
      translate: "अनुवाद करें",
      original: "मूल दिखाएँ",
      translating: "अनुवाद हो रहा है…",
      translateFailed: "अनुवाद विफल। फिर से प्रयास करें।",
      language: "भाषा",
      search: "खोजें",
      cancel: "रद्द करें",
      close: "बंद करें",
      retry: "पुनः प्रयास",
    },
    settings: {
      languageTitle: "🌍 भाषा",
      languageHint: "इंटरफ़ेस और अध्ययन-अनुवाद के लिए भाषा चुनें।",
    },
  },
  ar: {
    nav: {
      home: "الرئيسية",
      aiStudy: "الدراسة بالذكاء الاصطناعي",
      practice: "تدرب",
      flashcards: "بطاقات",
      revision: "مراجعة",
      focus: "تركيز",
      friends: "الأصدقاء",
      quests: "المهام",
      leaderboard: "المتصدرون",
      timetable: "الجدول",
      profile: "الملف الشخصي",
      settings: "الإعدادات",
      more: "المزيد",
    },
    common: {
      translate: "ترجم",
      original: "أظهر الأصل",
      translating: "جارٍ الترجمة…",
      translateFailed: "فشلت الترجمة. حاول مرة أخرى.",
      language: "اللغة",
      search: "بحث",
      cancel: "إلغاء",
      close: "إغلاق",
      retry: "إعادة المحاولة",
    },
    settings: {
      languageTitle: "🌍 اللغة",
      languageHint: "اختر لغة الواجهة ولغة ترجمة المحتوى الدراسي.",
    },
  },
  pt: {
    nav: {
      home: "Início",
      aiStudy: "Estudo IA",
      practice: "Prática",
      flashcards: "Cartões",
      revision: "Revisão",
      focus: "Foco",
      friends: "Amigos",
      quests: "Missões",
      leaderboard: "Classificação",
      timetable: "Horário",
      profile: "Perfil",
      settings: "Configurações",
      more: "Mais",
    },
    common: {
      translate: "Traduzir",
      original: "Mostrar original",
      translating: "Traduzindo…",
      translateFailed: "Falha na tradução. Tente novamente.",
      language: "Idioma",
      search: "Buscar",
      cancel: "Cancelar",
      close: "Fechar",
      retry: "Tentar de novo",
    },
    settings: {
      languageTitle: "🌍 Idioma",
      languageHint: "Escolha o idioma da interface e do conteúdo de estudo.",
    },
  },
  de: {
    nav: {
      home: "Start",
      aiStudy: "KI-Lernen",
      practice: "Üben",
      flashcards: "Karteikarten",
      revision: "Wiederholung",
      focus: "Fokus",
      friends: "Freunde",
      quests: "Quests",
      leaderboard: "Rangliste",
      timetable: "Stundenplan",
      profile: "Profil",
      settings: "Einstellungen",
      more: "Mehr",
    },
    common: {
      translate: "Übersetzen",
      original: "Original zeigen",
      translating: "Übersetze…",
      translateFailed: "Übersetzung fehlgeschlagen. Bitte erneut versuchen.",
      language: "Sprache",
      search: "Suchen",
      cancel: "Abbrechen",
      close: "Schließen",
      retry: "Erneut versuchen",
    },
    settings: {
      languageTitle: "🌍 Sprache",
      languageHint: "Wähle die Sprache für Oberfläche und Lerninhalte.",
    },
  },
};

/** Translate a UI string for the given language (falls back to English). */
export function tFor(lang: LanguageCode) {
  const pack = lang === DEFAULT_LANGUAGE ? undefined : TRANSLATIONS[lang];
  function t<K extends StringKey>(group: K, key: keyof Strings[K]): string {
    const groupVal = pack?.[group];
    const hit = groupVal ? (groupVal as Record<string, unknown>)[key as string] : undefined;
    return typeof hit === "string" ? hit : (STRINGS[group] as Record<string, unknown>)[key as string] as string;
  }
  return t;
}

export type TranslateFn = ReturnType<typeof tFor>;
