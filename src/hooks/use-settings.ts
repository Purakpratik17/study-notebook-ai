import {
  createElement,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { DEFAULT_LANGUAGE, type LanguageCode } from "@/lib/languages";
import { tFor } from "@/lib/i18n";
import { useAuth } from "@/hooks/use-auth";

/* ═══════════════════════════════════════════════════════════════════════
   Learnova settings — user-scoped preferences.

   Storage strategy: preferences are stored in localStorage under a key
   that includes the signed-in user id, so settings never leak between
   accounts on a shared device. Theme + appearance are UI concerns and
   belong locally (per device/browser); heavier server data (XP, unlocks,
   profiles) continues to live in Convex. Sound/notification toggles are
   also device-local because they control this browser's behavior.
   ═══════════════════════════════════════════════════════════════════════ */

export type Theme = "light" | "dark" | "system";
export type SoundVolume = number; // 0–1

export type LearnovaSettings = {
  soundEffects: boolean;
  soundVolume: SoundVolume;
  theme: Theme;
  animations: boolean;
  motivationalThoughts: boolean;
  studyReminders: boolean;
  questReminders: boolean;
  xpAnimations: boolean;
  arcadeSounds: boolean;
  adsEnabled: boolean;
  language: LanguageCode;
};

export const DEFAULT_SETTINGS: LearnovaSettings = {
  soundEffects: true,
  soundVolume: 0.7,
  theme: "system",
  animations: true,
  motivationalThoughts: true,
  studyReminders: false,
  questReminders: false,
  xpAnimations: true,
  arcadeSounds: true,
  adsEnabled: true,
  language: DEFAULT_LANGUAGE,
};

const KEY_PREFIX = "learnova:settings:";

function storageKey(userId: string | null | undefined) {
  // Fall back to a shared guest key when identity isn't ready yet.
  return KEY_PREFIX + (userId ?? "guest");
}

function loadSettings(userId: string | null | undefined): LearnovaSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = window.localStorage.getItem(storageKey(userId));
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<LearnovaSettings>;
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

type SettingsContextValue = {
  settings: LearnovaSettings;
  update: <K extends keyof LearnovaSettings>(
    key: K,
    value: LearnovaSettings[K],
  ) => void;
  resetAll: () => void;
  /** UI string lookup for the selected language (English fallback). */
  t: ReturnType<typeof tFor>;
};

const SettingsContext = createContext<SettingsContextValue | null>(null);

/* ─── Sound engine ───────────────────────────────────────────────────────

   All sounds are synthesized with the Web Audio API — zero audio assets in
   the bundle, nothing copyrighted. One AudioContext is lazily created and
   shared app-wide (cheap, and resumes after mobile autoplay restrictions
   once the user has interacted). Missing/failed audio never breaks the UI.
   ═════════════════════════════════════════════════════════════════════ */

type SoundKind =
  | "click" // subtle button tap
  | "success" // small two-note chime (task/quest done)
  | "xp" // quick rising blip (XP gained)
  | "levelup" // fanfare (rank up)
  | "correct" // pleasant ding
  | "incorrect" // soft low buzz
  | "complete" // session finished — small fanfare
  | "game" // arcade interaction blip
  | "unlock"; // achievement/unlock sparkle

const SOUND_RECIPES: Record<
  SoundKind,
  { notes: number[]; dur: number; type: OscillatorType; gap?: number; vol?: number }
> = {
  click: { notes: [520], dur: 0.07, type: "triangle", vol: 0.5 },
  success: { notes: [659.25, 783.99], dur: 0.13, type: "sine", gap: 0.09 },
  xp: { notes: [587.33, 880], dur: 0.11, type: "triangle", gap: 0.07 },
  levelup: {
    notes: [523.25, 659.25, 783.99, 1046.5],
    dur: 0.24,
    type: "triangle",
    gap: 0.11,
  },
  correct: { notes: [880, 1174.66], dur: 0.12, type: "sine", gap: 0.08 },
  incorrect: { notes: [220, 174.61], dur: 0.16, type: "square", gap: 0.1, vol: 0.35 },
  complete: {
    notes: [659.25, 783.99, 1046.5],
    dur: 0.2,
    type: "triangle",
    gap: 0.13,
  },
  game: { notes: [740], dur: 0.08, type: "square", vol: 0.4 },
  unlock: {
    notes: [1046.5, 1318.5, 1568],
    dur: 0.18,
    type: "sine",
    gap: 0.1,
  },
};

let sharedCtx: AudioContext | null = null;
function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    const Ctx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctx) return null;
    if (!sharedCtx) sharedCtx = new Ctx();
    if (sharedCtx.state === "suspended") void sharedCtx.resume();
    return sharedCtx;
  } catch {
    return null;
  }
}

let lastPlayedAt = 0;
/**
 * Play a short, subtle UI sound respecting the user's sound settings.
 * Throttled to 60 ms so rapid events never stack into a buzz.
 */
export function playUiSound(
  settings: LearnovaSettings | null,
  kind: SoundKind = "click",
) {
  if (!settings?.soundEffects) return;
  const now = Date.now();
  if (now - lastPlayedAt < 60) return;
  lastPlayedAt = now;

  try {
    const ctx = getCtx();
    if (!ctx) return;
    const recipe = SOUND_RECIPES[kind];
    const baseVol = (recipe.vol ?? 1) * settings.soundVolume * 0.3;
    recipe.notes.forEach((f, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = recipe.type;
      osc.frequency.value = f;
      const start = ctx.currentTime + i * (recipe.gap ?? 0.08);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(
        Math.max(0.001, baseVol),
        start + 0.015,
      );
      gain.gain.exponentialRampToValueAtTime(0.0001, start + recipe.dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + recipe.dur + 0.02);
    });
  } catch {
    // Audio is a nice-to-have; never break the UI over it.
  }
}

/** Convenience hook for pages: sound callbacks that respect settings. */
export function useSounds() {
  const { settings } = useSettings();
  return useMemo(
    () => ({
      click: () => playUiSound(settings, "click"),
      success: () => playUiSound(settings, "success"),
      xp: () => playUiSound(settings, "xp"),
      levelup: () => playUiSound(settings, "levelup"),
      correct: () => playUiSound(settings, "correct"),
      incorrect: () => playUiSound(settings, "incorrect"),
      complete: () => playUiSound(settings, "complete"),
      game: () => playUiSound(settings, "game"),
      unlock: () => playUiSound(settings, "unlock"),
    }),
    [settings],
  );
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const { userId } = useAuth();
  const [settings, setSettings] = useState<LearnovaSettings>(() =>
    loadSettings(userId),
  );

  // Reload when the signed-in user changes (logout/login).
  useEffect(() => {
    setSettings(loadSettings(userId));
  }, [userId]);

  // Persist on every change.
  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey(userId), JSON.stringify(settings));
    } catch {
      // storage full/unavailable — settings just won't persist
    }
  }, [settings, userId]);

  // Apply theme (light/dark/system) to <html>.
  useEffect(() => {
    const root = document.documentElement;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const dark =
        settings.theme === "dark" ||
        (settings.theme === "system" && mq.matches);
      root.classList.toggle("dark", dark);
    };
    apply();
    if (settings.theme === "system") {
      mq.addEventListener("change", apply);
      return () => mq.removeEventListener("change", apply);
    }
  }, [settings.theme]);

  // Apply animation preference + respect prefers-reduced-motion.
  useEffect(() => {
    const root = document.documentElement;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const enabled = settings.animations && !reduced;
    root.dataset.animations = enabled ? "on" : "off";
    if (!enabled) {
      root.classList.add("reduce-animations");
    } else {
      root.classList.remove("reduce-animations");
    }
  }, [settings.animations]);

  const update = useCallback(
    <K extends keyof LearnovaSettings>(key: K, value: LearnovaSettings[K]) => {
      setSettings((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const resetAll = useCallback(() => {
    setSettings(DEFAULT_SETTINGS);
  }, []);

  const t = useMemo(() => tFor(settings.language), [settings.language]);
  const value = useMemo(
    () => ({ settings, update, resetAll, t }),
    [settings, update, resetAll, t],
  );

  // createElement avoids JSX in a .ts file (JSX is only parsed in .tsx).
  return createElement(
    SettingsContext.Provider,
    { value },
    children,
  );
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used within SettingsProvider");
  return ctx;
}
