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
