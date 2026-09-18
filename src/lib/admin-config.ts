/* ═══════════════════════════════════════════════════════════════════════
   Learnova admin configuration — CENTRALIZED ADMIN ALLOWLIST.

   To change who has admin access: edit ADMIN_USER_IDS below. Each entry
   is the Clerk user ID (the `sub` claim / identity.subject), which is the
   secure internal identity — never a username or email.

   How to find your Clerk user ID:
   • Clerk Dashboard → Users → open the user → "User ID" (starts with
     user_), OR
   • Sign in to the app and open the Admin panel (once you're in the
     allowlist) — the "Who am I" card shows your Clerk user ID for easy
     copy/paste.

   SECURITY:
   • This allowlist is enforced on the Convex backend in src/convex/admin.ts
     (assertAdmin) — every admin query/mutation re-checks the caller's
     Clerk identity against this list. The frontend check is only used to
     show/hide the Admin nav entry and is NOT a security boundary.
   • To grant/remove admin access, edit this one file — it applies to
     both frontend visibility and backend enforcement.
   ═══════════════════════════════════════════════════════════════════════ */

export const ADMIN_USER_IDS: readonly string[] = [
  // TODO: paste your Clerk user ID here, e.g.:
  // "user_2abcExampleYourClerkId",
];

/**
 * ADMIN USERNAMES — alternative allowlist for convenience.
 *
 * Each entry is a Learnova username. Security is still enforced entirely
 * on the backend: in src/convex/admin.ts, the caller's OWN Clerk identity
 * is used to look up THEIR profile in the database, and only if that
 * profile's stored username matches an entry here do they pass. The
 * username is never sent from the client, so this cannot be spoofed.
 */
/**
 * DEV MODE: when true, EVERY signed-in user is treated as an admin.
 * Intended only for development. Set to false before shipping to production.
 */
export const ADMIN_DEV_MODE = true;

export const ADMIN_USERNAMES: readonly string[] = [
  "purakpratik17",
];
