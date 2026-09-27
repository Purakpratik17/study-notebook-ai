import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useAuth, useClerkSignOut } from "@/hooks/use-auth";
import {
  playUiSound,
  useSounds,
  useSettings,
  type Theme,
} from "@/hooks/use-settings";
import { LANGUAGES } from "@/lib/languages";
import { cn } from "@/lib/utils";
import { useChatPlus } from "@/hooks/use-chat-plus";
import { ChatPlusSheet } from "@/components/ChatPlusSheet";
import {
  Bell,
  BellOff,
  Gamepad2,
  Info,
  LogOut,
  Megaphone,
  Moon,
  NotebookPen,
  Palette,
  RotateCcw,
  ShieldAlert,
  Sparkles,
  Sun,
  SunMoon,
  Volume2,
  VolumeX,
  Zap,
  Globe,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

/* ═══════════════════════════════════════════════════════════════════════
   Settings — Cerevyn notebook-style preferences page.

   Storage: preferences live in localStorage scoped to the signed-in user
   (see src/hooks/use-settings.ts). No schema/backend changes; settings
   never leak between accounts on a shared device.
   ═══════════════════════════════════════════════════════════════════════ */

export default function Settings() {
  const { settings, update, resetAll } = useSettings();
  const sounds = useSounds();
  const { name, email } = useAuth();
  const signOut = useClerkSignOut();
  const [deleteConfirm, setDeleteConfirm] = useState("");

  const toggleSound = (on: boolean) => {
    update("soundEffects", on);
    if (on) setTimeout(() => playUiSound(settings, "success"), 60);
  };

  // Preview each chime when the volume slider changes (respects ON/OFF).

  const themeOptions: { value: Theme; label: string; icon: typeof Sun }[] = [
    { value: "light", label: "Light", icon: Sun },
    { value: "dark", label: "Dark", icon: Moon },
    { value: "system", label: "System", icon: SunMoon },
  ];

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight">
          <NotebookPen className="size-7 text-primary" /> Settings
        </h1>
        <p className="annotation text-sm">
          tune your notebook to feel just right ✎
        </p>
      </header>

      {/* ── Appearance ─────────────────────────────────────────── */}
      <SettingsCard
        icon={Palette}
        title="🎨 Appearance"
        hint="Theme applies instantly and persists on this device."
      >
        <div className="grid grid-cols-3 gap-2">
          {themeOptions.map((opt) => {
            const active = settings.theme === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => update("theme", opt.value)}
                aria-pressed={active}
                className={cn(
                  "flex min-h-16 flex-col items-center justify-center gap-1.5 rounded-lg border bg-card text-xs font-semibold transition",
                  active
                    ? "border-primary bg-primary/10 text-primary"
                    : "hover:bg-accent",
                )}
              >
                <opt.icon className="size-5" />
                {opt.label}
              </button>
            );
          })}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Dark mode reuses Cerevyn's existing dark notebook palette — your
          notes, XP bar and rank colors all adapt automatically.
        </p>
      </SettingsCard>

      {/* ── Language ───────────────────────────────────────────── */}
      <LanguageSection />

      {/* ── Chat+ ───────────────────────────────────────────────── */}
      <ChatPlusCard />

      {/* ── Sound ──────────────────────────────────────────────── */}
      <SettingsCard
        icon={settings.soundEffects ? Volume2 : VolumeX}
        title="🔊 Sound Effects"
        hint="Short UI chimes for correct answers, XP, and level-ups."
      >
        <SettingRow
          label="Sound effects"
          description={
            settings.soundEffects ? "ON — UI sounds play" : "OFF — silent UI"
          }
        >
          <Switch
            checked={settings.soundEffects}
            onCheckedChange={toggleSound}
            aria-label="Toggle sound effects"
          />
        </SettingRow>
        {settings.soundEffects && (
          <SettingRow label="Volume" description={`${Math.round(settings.soundVolume * 100)}%`}>
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(settings.soundVolume * 100)}
              onChange={(e) => {
                update("soundVolume", Number(e.target.value) / 100);
                playUiSound({ ...settings, soundVolume: Number(e.target.value) / 100 }, "correct");
              }}
              className="h-2 w-40 cursor-pointer accent-[var(--primary)]"
              aria-label="Sound volume"
            />
          </SettingRow>
        )}
        <p className="mt-3 text-xs text-muted-foreground">
          Turning sounds off silences Cerevyn's UI chimes only — it never
          changes your device or system volume.
        </p>
      </SettingsCard>

      {/* ── Experience ─────────────────────────────────────────── */}
      <SettingsCard
        icon={Sparkles}
        title="✨ Experience"
        hint="Motion and encouragement, your way."
      >
        <SettingRow
          label="Animations"
          description={
            settings.animations
              ? "ON — full motion"
              : "OFF — reduced motion (also respects your system's reduced-motion setting)"
          }
        >
          <Switch
            checked={settings.animations}
            onCheckedChange={(v) => update("animations", v)}
            aria-label="Toggle animations"
          />
        </SettingRow>
        <SettingRow
          label="Motivational thoughts"
          description={
            settings.motivationalThoughts
              ? "ON — little encouraging notes appear"
              : "OFF — motivational notes are hidden"
          }
        >
          <Switch
            checked={settings.motivationalThoughts}
            onCheckedChange={(v) => update("motivationalThoughts", v)}
            aria-label="Toggle motivational thoughts"
          />
        </SettingRow>
      </SettingsCard>

      {/* ── Notifications ──────────────────────────────────────── */}
      <SettingsCard
        icon={Bell}
        title="🔔 Notifications"
        hint="Reminder preferences — saved now, honored when notifications ship."
      >
        <SettingRow
          label="Study reminders"
          description={
            settings.studyReminders
              ? "ON (saved)"
              : "OFF"
          }
        >
          <Switch
            checked={settings.studyReminders}
            onCheckedChange={(v) => update("studyReminders", v)}
            aria-label="Toggle study reminders"
          />
        </SettingRow>
        <SettingRow
          label="Quest reminders"
          description={
            settings.questReminders ? "ON (saved)" : "OFF"
          }
        >
          <Switch
            checked={settings.questReminders}
            onCheckedChange={(v) => update("questReminders", v)}
            aria-label="Toggle quest reminders"
          />
        </SettingRow>
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-dashed bg-card/60 px-3 py-2.5 text-xs text-muted-foreground">
          <Info className="mt-0.5 size-3.5 shrink-0" />
          <p>
            Cerevyn doesn't send push notifications yet. These preferences are
            stored so your choice is ready the moment reminders arrive — no
            notifications are being delivered right now.
          </p>
        </div>
      </SettingsCard>

      {/* ── Gameplay ───────────────────────────────────────────── */}
      <SettingsCard
        icon={Gamepad2}
        title="🎮 Gameplay"
        hint="Keep the rewards, trim the sparkle."
      >
        <SettingRow
          label="XP gain animations"
          description={
            settings.xpAnimations
              ? "ON — floating +XP effects and toasts"
              : "OFF — XP still awarded normally, silently"
          }
        >
          <Switch
            checked={settings.xpAnimations}
            onCheckedChange={(v) => update("xpAnimations", v)}
            aria-label="Toggle XP animations"
          />
        </SettingRow>
        <SettingRow
          label="Arcade sounds"
          description={
            settings.arcadeSounds
              ? "ON — Study Blocks & Study Bee make noise"
              : "OFF — arcade games are silent"
          }
        >
          <Switch
            checked={settings.arcadeSounds}
            onCheckedChange={(v) => update("arcadeSounds", v)}
            aria-label="Toggle arcade sounds"
          />
        </SettingRow>
        <p className="mt-3 text-xs text-muted-foreground">
          <Zap className="mr-1 inline size-3.5 text-xp" />
          Arcade sounds are separate from general sound effects, so you can keep
          study chimes but quiet games (or the reverse). Turning off master
          <span className="mx-1 font-semibold">Sound Effects</span> mutes
          everything.
        </p>
      </SettingsCard>

      {/* ── Ads & Privacy ──────────────────────────────────────── */}
      <SettingsCard
        icon={Megaphone}
        title="📢 Ads & Privacy"
        hint="Support Cerevyn with unobtrusive ads."
      >
        <SettingRow
          label="Show ads"
          description={
            settings.adsEnabled
              ? "ON — small banners may appear on Home, after Notes, in Friends, Timetable, Quests, Profile and the Arcade hub (never in Settings, during questions, or mid-game)"
              : "OFF — no ads are shown anywhere in the app"
          }
        >
          <Switch
            checked={settings.adsEnabled}
            onCheckedChange={(v) => {
              update("adsEnabled", v);
              sounds.click();
            }}
            aria-label="Toggle ads"
          />
        </SettingRow>
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-dashed bg-card/60 px-3 py-2.5 text-xs text-muted-foreground">
          <Info className="mt-0.5 size-3.5 shrink-0" />
          <p>
            Ads use Google AdMob and appear only on Android at natural, quiet
            spots — never over notes, quizzes, buttons or navigation. On the
            web version no ad code runs at all. Cerevyn never sends your
            email, sign-in details, notes or study data to advertisers. Where
            required by law (e.g. the EEA), Google's consent form is shown
            before ads serve, and you can revisit your privacy choices via the
            Google privacy options in the app.
          </p>
        </div>
      </SettingsCard>

      {/* ── Account ────────────────────────────────────────────── */}
      <SettingsCard
        icon={ShieldAlert}
        title="👤 Account"
        hint="Local study session — account features coming soon."
      >
        <div className="flex items-center justify-between gap-3 rounded-lg border bg-card/70 px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{name}</p>
            {email && (
              <p className="truncate text-xs text-muted-foreground">{email}</p>
            )}
          </div>
          <Badge variant="outline" className="shrink-0">
            Active
          </Badge>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button variant="outline" onClick={() => { sounds.click(); signOut(); }} className="flex-1">
            <LogOut className="size-4" /> Log out
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              resetAll();
              sounds.click();
              toast.success("All settings reset to defaults");
            }}
            className="flex-1"
          >
            <RotateCcw className="size-4" /> Reset settings
          </Button>
        </div>

        {/* Account deletion — warning + typed confirmation, no destructive
            action wired until account management returns. */}
        <details className="mt-2 rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3">
          <summary className="cursor-pointer text-sm font-semibold text-destructive">
            Delete account
          </summary>
          <p className="mt-2 text-xs text-muted-foreground">
            Deleting your account is <strong>permanent</strong>. All of your
            notes, XP, rank progress, quests, timetable and arcade records will
            be erased and cannot be recovered. Type <code>DELETE</code> below to
            confirm — deletion is handled securely through our support flow.
          </p>
          <Input
            value={deleteConfirm}
            onChange={(e) => setDeleteConfirm(e.target.value)}
            placeholder='Type "DELETE" to confirm'
            className="mt-2 max-w-xs"
            aria-label="Type DELETE to confirm account deletion"
          />
          <Button
            variant="destructive"
            className="mt-2"
            disabled={deleteConfirm !== "DELETE"}
            onClick={() => {
              toast.error(
                "Account deletion is temporarily unavailable while account features are being upgraded.",
              );
              setDeleteConfirm("");
            }}
          >
            <BellOff className="size-4" /> Request account deletion
          </Button>
        </details>
      </SettingsCard>

      <p className="annotation pb-2 text-center text-xs">
        preferences are saved per account on this device 🔒
      </p>
    </div>
  );
}

/* ─── Language ─────────────────────────────────────────────────────── */

function LanguageSection() {
  const { settings, update, t } = useSettings();
  const sounds = useSounds();
  const [query, setQuery] = useState("");
  const list = LANGUAGES.filter((l) =>
    (l.name + " " + l.native).toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <SettingsCard
      icon={Globe}
      title={t("settings", "languageTitle")}
      hint={t("settings", "languageHint")}
    >
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t("common", "search")}
        className="h-10 w-full rounded-lg border bg-background px-3 text-sm"
        aria-label="Search languages"
      />
      <div className="grid max-h-64 grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3">
        {list.map((l) => {
          const active = settings.language === l.code;
          return (
            <button
              key={l.code}
              onClick={() => {
                update("language", l.code);
                sounds.click();
              }}
              aria-pressed={active}
              className={cn(
                "rounded-lg border bg-card px-3 py-2.5 text-left text-sm font-semibold transition",
                active
                  ? "border-primary bg-primary/10 text-primary"
                  : "hover:bg-accent",
              )}
            >
              {l.native}
              <span className="annotation block text-[11px]">{l.name}</span>
            </button>
          );
        })}
        {list.length === 0 && (
          <p className="col-span-full text-sm text-muted-foreground">
            No languages match “{query}”.
          </p>
        )}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        The interface uses your language where translations are available.
        Study content (notes, quizzes, practice) can be translated on demand
        with the 🌐 Translate button — the original is always kept.
      </p>
    </SettingsCard>
  );
}

/* ─── building blocks ─────────────────────────────────────────────── */

function SettingsCard({
  icon: Icon,
  title,
  hint,
  children,
}: {
  icon: typeof Palette;
  title: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <section className="paper-sheet spiral-edge px-5 py-5 sm:px-7">
      <div className="mb-4 flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="size-5" />
        </span>
        <div>
          <h2 className="text-lg font-bold tracking-tight">{title}</h2>
          <p className="annotation text-xs">{hint}</p>
        </div>
      </div>
      <div className="flex flex-col gap-3">{children}</div>
    </section>
  );
}

function SettingRow({
  label,
  description,
  children,
}: {
  label: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border bg-card/70 px-4 py-3.5">
      <div className="min-w-0">
        <p className="text-sm font-semibold">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

/* ─── Chat+ entry (upgrade / manage) ─────────────────────────────── */

function ChatPlusCard() {
  const [open, setOpen] = useState(false);
  const { plus } = useChatPlus();
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-4 rounded-lg border bg-card/70 px-4 py-3.5 text-left transition hover:bg-accent"
      >
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-purple-600/10 text-lg">
          💜
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2 font-semibold">
            Chat+
            {plus && (
              <span className="rounded-full bg-purple-600/15 px-2 py-0.5 text-[10px] font-bold uppercase text-purple-600 dark:text-purple-400">
                Active
              </span>
            )}
          </span>
          <span className="block text-xs text-muted-foreground">
            {plus
              ? "Manage your Chat+ subscription and chat settings."
              : "₹99/month · ₹499/year — files, long videos, ad-free chat & more."}
          </span>
        </span>
        <span className="text-muted-foreground">›</span>
      </button>
      {open && <ChatPlusSheet onClose={() => setOpen(false)} />}
    </>
  );
}
