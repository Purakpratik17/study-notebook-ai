import { api } from "@/convex/_generated/api";
import { languageByCode, LANGUAGES, type LanguageCode } from "@/lib/languages";
import { useAction } from "convex/react";
import { Globe, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useSettings } from "@/hooks/use-settings";

/* ═══════════════════════════════════════════════════════════════════════
   TranslateButton — on-demand AI translation for study content.

   • Fires only when the user presses Translate (never auto-translates).
   • Caches per (content, target) in memory so repeat presses within the
     session don't re-call the AI.
   • Shows translated content without discarding the original — the
     "Show original" toggle switches back instantly.
   ═══════════════════════════════════════════════════════════════════════ */

/** Per-module session cache shared by all TranslateButton instances. */
const sessionCache = new Map<string, string>();

export function useTranslator(content: string) {
  const { settings, t } = useSettings();
  const translateAction = useAction(api.translate.translate);
  const [active, setActive] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const translated = active ? (sessionCache.get(`${active}::${content}`) ?? null) : null;

  const translateTo = async (lang: LanguageCode) => {
    if (lang === "en" || !content.trim() || loading) return;
    const key = `${lang}::${content}`;
    if (sessionCache.has(key)) {
      setActive(lang);
      return;
    }
    setLoading(true);
    try {
      const r = await translateAction({
        text: content,
        targetLanguage: languageByCode(lang).name,
        sourceLanguage: "English",
      });
      sessionCache.set(key, r.translated);
      setActive(lang);
    } catch (e) {
      toast.error(
        e instanceof Error && e.message ? e.message : t("common", "translateFailed"),
      );
    } finally {
      setLoading(false);
    }
  };

  return {
    t,
    active,
    translated,
    loading,
    text: translated ?? content,
    isTranslated: translated !== null,
    translateTo,
    showOriginal: () => setActive(null),
  };
}

export function TranslateButton({ content }: { content: string }) {
  const { settings } = useSettings();
  const { t, active, loading, isTranslated, translateTo, showOriginal } =
    useTranslator(content);
  const [pick, setPick] = useState<LanguageCode | "">(
    settings.language !== "en" ? settings.language : "",
  );

  return (
    <div className="flex flex-wrap items-center gap-2">
      {active ? (
        <button
          type="button"
          onClick={showOriginal}
          className="inline-flex items-center gap-1.5 rounded-lg border bg-background px-3 py-2 text-xs font-semibold transition hover:bg-accent"
        >
          <Globe className="size-3.5 text-primary" />
          {t("common", "original")}
        </button>
      ) : (
        <button
          type="button"
          onClick={() => {
            if (pick) void translateTo(pick as LanguageCode);
          }}
          disabled={loading || !pick}
          title={!pick ? "Pick a language first" : undefined}
          className="inline-flex items-center gap-1.5 rounded-lg border bg-background px-3 py-2 text-xs font-semibold transition hover:bg-accent disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="size-3.5 animate-spin text-primary" />
          ) : (
            <Globe className="size-3.5 text-primary" />
          )}
          {loading ? t("common", "translating") : t("common", "translate")}
        </button>
      )}

      {!active && (
        <select
          aria-label="Target language"
          value={pick}
          onChange={(e) => {
            const lang = e.target.value as LanguageCode;
            setPick(lang);
            void translateTo(lang);
          }}
          className="rounded-lg border bg-background px-2 py-2 text-xs font-semibold"
        >
          <option value="" disabled>
            🌐 {t("common", "language")} ▾
          </option>
          {LANGUAGES.filter((l) => l.code !== "en").map((l) => (
            <option key={l.code} value={l.code}>
              {l.native}
            </option>
          ))}
        </select>
      )}
      {active && isTranslated && (
        <span className="annotation text-[11px]">{languageByCode(active).native}</span>
      )}
    </div>
  );
}
