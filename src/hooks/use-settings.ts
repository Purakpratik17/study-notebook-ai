import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
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
};

const SettingsContext = createContext<SettingsContextValue | null>(null);

/** Play a short UI sound respecting the sound settings. */
export function playUiSound(
  settings: LearnovaSettings | null,
  kind: "success" | "click" | "levelup" = "click",
) {
  if (!settings?.soundEffects) return;
  if (typeof window === "undefined") return;
  try {
    const Ctx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const freqs =
      kind === "levelup"
        ? [523.25, 659.25, 783.99]
        : kind === "success"
          ? [659.25, 783.99]
          : [440];
    const dur = kind === "levelup" ? 0.35 : 0.15;
    freqs.forEach((f, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = f;
      const start = ctx.currentTime + i * (dur / (freqs.length + 0.5));
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(
        Math.max(0.001, settings.soundVolume * 0.35),
        start + 0.02,
      );
      gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + dur + 0.02);
    });
    setTimeout(() => void ctx.close(), (dur + 0.3) * 1000 + freqs.length * 200);
  } catch {
    // Audio is a nice-to-have; never break the UI over it.
  }
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

  const value = useMemo(
    () => ({ settings, update, resetAll }),
    [settings, update, resetAll],
  );

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used within SettingsProvider");
  return ctx;
}
