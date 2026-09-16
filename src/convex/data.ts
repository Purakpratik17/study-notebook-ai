import { v } from "convex/values";

/**
 * Central, configurable XP economy.
 * Change these values to retune rewards — the UI reads live values from
 * `api.config.get` so nothing is hard-coded across screens.
 */
export const XP_REWARDS = {
  TIMETABLE_TASK: 20,
  STUDY_SESSION: 30,
  QUIZ_COMPLETED: 25,
  QUEST_EASY: 15,
  QUEST_MEDIUM: 40,
  QUEST_HARD: 80,
  DAILY_GOAL_BONUS: 30,
} as const;

export const DAILY_GOAL_MINUTES = 60;

/** Level thresholds: cumulative XP required to *reach* each level. */
export type LevelDef = { level: number; xp: number; name: string };
export const LEVELS: LevelDef[] = [
  { level: 1, xp: 0, name: "Beginner" },
  { level: 2, xp: 400, name: "Learner" },
  { level: 3, xp: 1000, name: "Scholar" },
  { level: 4, xp: 2000, name: "Achiever" },
  { level: 5, xp: 3500, name: "Expert" },
];

/** Today's date as YYYY-MM-DD in UTC. */
export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function levelForXp(xp: number): LevelDef {
  let current: LevelDef = LEVELS[0];
  for (const l of LEVELS) {
    if (xp >= l.xp) current = l;
  }
  return current;
}

export function nextLevel(level: number) {
  return LEVELS.find((l) => l.level === level + 1) ?? null;
}

/** Validate the shape of a Clerk identity into typed user info. */
export function clerkUserFromIdentity(
  identity: {
    subject: string;
    name?: string | null;
    givenName?: string | null;
    email?: string | null;
    pictureUrl?: string | null;
    issuer?: string | null;
  } | null,
) {
  if (!identity || !identity.subject) return null;
  const isClerk = !identity.issuer || identity.issuer.includes("clerk");
  if (!isClerk) return null; // only accept our Clerk-issued identities
  return {
    externalId: identity.subject,
    name:
      identity.name ??
      identity.givenName ??
      identity.email ??
      identity.subject.slice(0, 12),
    email: identity.email ?? undefined,
    image: identity.pictureUrl ?? undefined,
  };
}

/** Payload of a Clerk JWT validated by Convex via the issuer domain. */
export const identityValidator = v.object({
  subject: v.string(),
  name: v.optional(v.string()),
  givenName: v.optional(v.string()),
  email: v.optional(v.string()),
  pictureUrl: v.optional(v.string()),
});

export type IdentityInfo = {
  subject: string;
  name?: string;
  givenName?: string;
  email?: string;
  pictureUrl?: string;
};
