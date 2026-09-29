import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "convex/react";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  BookOpenCheck,
  CalendarCheck2,
  Check,
  Flame,
  Lock,
  Loader2,
  Pencil,
  Sigma,
  Star,
  Swords,
  Target,
  Trophy,
  X,
} from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

type Stats = {
  xp: number;
  level: number;
  levelName: string;
  nextLevel: number | null;
  nextLevelName: string | null;
  xpIntoLevel: number;
  xpForNextLevel: number;
  xpNeeded: number;
  progress: number;
  maxLevel: boolean;
  streak: number;
  bestStreak: number;
  totalTasksCompleted: number;
  totalQuizzesCompleted: number;
  quizAverage: number | null;
  totalMinutesStudied: number;
};

type ProfileData = {
  displayName?: string;
  username?: string;
  bio?: string;
  avatar?: string;
  school?: string;
  course?: string;
  interests?: string;
  createdAt?: number;
};

type Achievement = {
  id: string;
  name: string;
  desc: string;
  unlocked: boolean;
  unlockedAt: number | null;
  progress: number;
};

type LevelDef = { level: number; xp: number; name: string };

const MAX_BIO = 280;
const MAX_AVATAR_BYTES = 200 * 1024;

function fmtHours(mins: number) {
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export default function Profile() {
  const { name, imageUrl } = useAuth();
  const data = useQuery(api.profiles.getMyProfile) as
    | { profile: ProfileData | null; unlocked: string[] }
    | undefined;
  const achievements = useQuery(api.profiles.listAchievements) as
    | Achievement[]
    | undefined;
  const stats = useQuery(api.stats.getStats) as Stats | null | undefined;
  const questsDone = useQuery(api.quests.completedCount);
  const notes = useQuery(api.notes.list);
  const levels = useQuery(api.config.get);
  const saveProfile = useMutation(api.profiles.saveProfile);

  const profile = data?.profile ?? null;
  const avatarSrc = profile?.avatar ?? imageUrl;
  const displayName = profile?.displayName ?? name;

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    displayName: "",
    username: "",
    bio: "",
    school: "",
    course: "",
    interests: "",
  });
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const startEdit = () => {
    setForm({
      displayName: profile?.displayName ?? "",
      username: profile?.username ?? "",
      bio: profile?.bio ?? "",
      school: profile?.school ?? "",
      course: profile?.course ?? "",
      interests: profile?.interests ?? "",
    });
    setAvatarPreview(profile?.avatar ?? null);
    setEditing(true);
  };

  const handleFile = (f: File | undefined) => {
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      toast.error("Please choose an image file");
      return;
    }
    if (f.size > MAX_AVATAR_BYTES) {
      toast.error("Image too large — pick one under 200KB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setAvatarPreview(reader.result as string);
    reader.readAsDataURL(f);
  };

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await saveProfile({
        displayName: form.displayName || undefined,
        username: form.username || undefined,
        bio: form.bio || undefined,
        school: form.school || undefined,
        course: form.course || undefined,
        interests: form.interests || undefined,
        avatar: avatarPreview ?? undefined,
      });
      toast.success("Profile saved ✨");
      setEditing(false);
      setAvatarPreview(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save profile");
    } finally {
      setSaving(false);
    }
  };

  const joined = profile?.createdAt
    ? new Date(profile.createdAt).toLocaleDateString(undefined, {
        month: "long",
        year: "numeric",
      })
    : null;

  const levelList: LevelDef[] = levels?.levels ?? [];
  const unlockedCount = (achievements ?? []).filter((a) => a.unlocked).length;

  return (
    <div className="flex flex-col gap-6">
      {/* Identity card */}
      <section className="card-3d paper-sheet paper-margin flex flex-col items-center gap-4 px-6 py-6 text-center sm:flex-row sm:text-left md:pl-20">
        <Avatar className="size-20 border-2 border-primary/30 shadow-md">
          {avatarSrc && <AvatarImage src={avatarSrc} alt={displayName} />}
          <AvatarFallback className="bg-highlight-soft text-2xl font-bold">
            {displayName.slice(0, 1).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="annotation text-sm">student profile</p>
          <h1 className="truncate text-2xl font-bold tracking-tight">
            {displayName}
          </h1>
          {profile?.username && (
            <p className="truncate text-sm text-muted-foreground">
              @{profile.username}
            </p>
          )}
          {profile?.bio && (
            <p className="mt-1 line-clamp-2 text-sm text-foreground/75">
              {profile.bio}
            </p>
          )}
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
            {profile?.school && <span>🏫 {profile.school}</span>}
            {profile?.course && <span>📚 {profile.course}</span>}
            {joined && <span>joined {joined}</span>}
          </p>
        </div>
        {stats && (
          <div className="level-chip flex flex-col items-center rounded-xl bg-card px-5 py-3">
            <span className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
              Level
            </span>
            <span className="text-3xl font-black leading-none text-primary">
              {stats.level}
            </span>
            <span className="mt-1 text-xs font-semibold text-marker">
              {stats.levelName}
            </span>
          </div>
        )}
        {!editing && (
          <Button
            onClick={startEdit}
            size="sm"
            className="gap-1.5 self-center sm:self-start"
          >
            <Pencil className="size-3.5" /> Edit profile
          </Button>
        )}
      </section>

      {/* Edit form */}
      {editing && (
        <section className="paper-sheet spiral-edge px-5 py-5 md:px-7">
          <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-ink-soft">
            <Pencil className="size-4" /> Edit profile
          </h2>

          <div className="mt-4 flex items-center gap-4">
            <Avatar className="size-16 border-2 border-primary/30">
              {avatarPreview && (
                <AvatarImage src={avatarPreview} alt="Avatar preview" />
              )}
              <AvatarFallback className="bg-highlight-soft text-xl font-bold">
                {(form.displayName || displayName).slice(0, 1).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col gap-2">
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                className="hidden"
                onChange={(e) => handleFile(e.target.files?.[0])}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileRef.current?.click()}
              >
                Upload picture
              </Button>
              <p className="text-[11px] text-muted-foreground">
                PNG/JPG/WebP, under 200KB
              </p>
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Field label="Display name">
              <input
                value={form.displayName}
                maxLength={60}
                onChange={(e) => setForm({ ...form, displayName: e.target.value })}
                className="h-10 w-full rounded-lg border bg-background/60 px-3 text-sm outline-none ring-ring/40 focus:ring-2"
                placeholder="How should we call you?"
              />
            </Field>
            <Field label="Username">
              <input
                value={form.username}
                maxLength={20}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                className="h-10 w-full rounded-lg border bg-background/60 px-3 text-sm outline-none ring-ring/40 focus:ring-2"
                placeholder="unique handle, 3–20 chars"
              />
            </Field>
            <Field label={`Bio (${form.bio.length}/${MAX_BIO})`}>
              <textarea
                value={form.bio}
                maxLength={MAX_BIO}
                rows={3}
                onChange={(e) => setForm({ ...form, bio: e.target.value })}
                className="w-full rounded-lg border bg-background/60 p-3 text-sm outline-none ring-ring/40 focus:ring-2"
                placeholder="A line or two about you…"
              />
            </Field>
            <div className="grid gap-3">
              <Field label="School / college (optional)">
                <input
                  value={form.school}
                  maxLength={80}
                  onChange={(e) => setForm({ ...form, school: e.target.value })}
                  className="h-10 w-full rounded-lg border bg-background/60 px-3 text-sm outline-none ring-ring/40 focus:ring-2"
                />
              </Field>
              <Field label="Course / class (optional)">
                <input
                  value={form.course}
                  maxLength={80}
                  onChange={(e) => setForm({ ...form, course: e.target.value })}
                  className="h-10 w-full rounded-lg border bg-background/60 px-3 text-sm outline-none ring-ring/40 focus:ring-2"
                />
              </Field>
            </div>
            <Field label="Interests (optional)">
              <input
                value={form.interests}
                maxLength={120}
                onChange={(e) => setForm({ ...form, interests: e.target.value })}
                className="h-10 w-full rounded-lg border bg-background/60 px-3 text-sm outline-none ring-ring/40 focus:ring-2"
                placeholder="physics, chess, guitar…"
              />
            </Field>
          </div>

          <div className="mt-4 flex gap-2">
            <Button onClick={handleSave} disabled={saving} className="gap-1.5">
              {saving ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Check className="size-4" />
              )}
              Save profile
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setEditing(false);
                setAvatarPreview(null);
              }}
              className="gap-1.5"
            >
              <X className="size-4" /> Cancel
            </Button>
          </div>
        </section>
      )}

      {stats === undefined ? (
        <div className="paper-sheet shimmer h-40" />
      ) : stats === null ? (
        <p className="text-sm text-muted-foreground">
          Sign in to see your progress.
        </p>
      ) : (
        <>
          {/* XP card */}
          <section className="paper-sheet spiral-edge px-5 py-5 md:px-7">
            <div className="flex items-end justify-between gap-3">
              <div>
                <h2 className="flex items-center gap-2 text-lg font-bold">
                  <Star className="size-4 text-highlight" /> Total XP
                </h2>
                <p className="mt-1 text-3xl font-black tracking-tight">
                  {stats.xp.toLocaleString()}{" "}
                  <span className="text-sm font-semibold text-muted-foreground">
                    XP
                  </span>
                </p>
              </div>
              <div className="text-right text-sm">
                {stats.maxLevel ? (
                  <p className="font-semibold text-xp">
                    Max level reached! 🎉
                  </p>
                ) : (
                  <>
                    <p className="font-semibold">
                      {stats.xpNeeded} XP to Level {stats.nextLevel}
                    </p>
                    <p className="annotation text-xs">
                      next: {stats.nextLevelName}
                    </p>
                  </>
                )}
              </div>
            </div>
            <div className="mt-3 h-3.5 overflow-hidden rounded-full border border-border/70 bg-paper-deep">
              <div
                className="h-full rounded-full bg-gradient-to-r from-xp/80 to-xp transition-all duration-700"
                style={{ width: `${Math.round(stats.progress * 100)}%` }}
              />
            </div>
            {!stats.maxLevel && (
              <p className="mt-1.5 text-xs text-muted-foreground">
                {stats.xpIntoLevel} / {stats.xpForNextLevel} XP into this level
              </p>
            )}
          </section>

          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <StatCard
              icon={<Flame className="size-4" />}
              label="Study streak"
              value={`${stats.streak} day${stats.streak === 1 ? "" : "s"}`}
              sub={`best: ${stats.bestStreak}`}
            />
            <StatCard
              icon={<Swords className="size-4" />}
              label="Quests done"
              value={String(questsDone?.total ?? 0)}
              sub="lifetime"
            />
            <StatCard
              icon={<CalendarCheck2 className="size-4" />}
              label="Tasks completed"
              value={String(stats.totalTasksCompleted)}
              sub="timetable"
            />
            <StatCard
              icon={<BookOpenCheck className="size-4" />}
              label="Quizzes taken"
              value={String(stats.totalQuizzesCompleted)}
              sub="AI study"
            />
            <StatCard
              icon={<Sigma className="size-4" />}
              label="Quiz average"
              value={
                stats.quizAverage !== null ? `${stats.quizAverage}%` : "—"
              }
              sub="all attempts"
            />
            <StatCard
              icon={<Target className="size-4" />}
              label="Total study time"
              value={fmtHours(stats.totalMinutesStudied ?? 0)}
              sub={`${notes?.length ?? 0} saved notes`}
            />
          </div>

          {/* Achievements */}
          <section className="paper-sheet px-5 py-5 md:px-7">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-ink-soft">
                <Trophy className="size-4" /> Achievements
              </h2>
              <span className="text-xs font-semibold text-muted-foreground">
                {unlockedCount}/{achievements?.length ?? 0} unlocked
              </span>
            </div>
            {achievements === undefined ? (
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="shimmer h-20 rounded-lg" />
                ))}
              </div>
            ) : (
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {achievements.map((a) => (
                  <div
                    key={a.id}
                    title={a.desc}
                    className={cn(
                      "relative flex flex-col gap-1 rounded-lg border px-3 py-3 transition",
                      a.unlocked
                        ? "border-highlight/60 bg-highlight-soft/30 shadow-sm"
                        : "border-border bg-card/50",
                    )}
                  >
                    <span className="flex items-center gap-1.5 text-sm font-bold">
                      {a.unlocked ? (
                        <>🏆 {a.name}</>
                      ) : (
                        <>
                          <Lock className="size-3.5 text-ink-faint" />
                          <span className="text-muted-foreground">{a.name}</span>
                        </>
                      )}
                    </span>
                    <span className="line-clamp-2 text-[11px] text-muted-foreground">
                      {a.desc}
                    </span>
                    {!a.unlocked && a.progress > 0 && (
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-paper-deep">
                        <div
                          className="h-full rounded-full bg-primary/60 transition-all"
                          style={{ width: `${Math.round(a.progress * 100)}%` }}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>


          {/* Level ladder */}
          {levelList.length > 0 && (
            <section className="paper-sheet px-5 py-5 md:px-7">
              <h2 className="text-sm font-bold uppercase tracking-wide text-ink-soft">
                Level ladder
              </h2>
              <ul className="ruled-list mt-2 flex flex-col">
                {levelList.map((l) => {
                  const reached = stats.xp >= l.xp;
                  const isCurrent = stats.level === l.level;
                  return (
                    <li
                      key={l.level}
                      className="flex items-center gap-3 py-2.5 text-sm"
                    >
                      <span
                        className={cn(
                          "flex size-8 shrink-0 items-center justify-center rounded-full border text-xs font-black",
                          isCurrent
                            ? "border-primary bg-primary text-primary-foreground"
                            : reached
                              ? "border-xp/60 bg-xp/10 text-xp"
                              : "border-border bg-card text-muted-foreground",
                        )}
                      >
                        {l.level}
                      </span>
                      <span
                        className={cn(
                          "flex-1 font-semibold",
                          !reached && "text-muted-foreground",
                        )}
                      >
                        {l.name}
                        {isCurrent && (
                          <span className="annotation ml-2 text-xs">
                            ← you are here
                          </span>
                        )}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {l.xp} XP
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="font-semibold">{label}</span>
      {children}
    </label>
  );
}

function StatCard({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="paper-sheet spiral-edge flex flex-col gap-1 px-4 py-3.5">
      <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-soft">
        {icon}
        {label}
      </span>
      <span className="text-2xl font-black leading-tight">{value}</span>
      <span className="text-[11px] text-muted-foreground">{sub}</span>
    </div>
  );
}
