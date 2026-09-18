/* ═══════════════════════════════════════════════════════════════════════
   Learnova admin configuration — CENTRALIZED ADMIN ALLOWLIST.

   Admin access is granted ONLY to the Clerk user IDs listed below. Each
   entry is the Clerk user ID (the `sub` claim / identity.subject), which
   is the secure internal identity — never a username or email.

   SECURITY:
   • Enforced on the Convex backend in src/convex/admin.ts (assertAdmin).
     Every admin query/mutation re-derives the caller's identity from the
     Clerk JWT and checks it against this list. Nothing is trusted from
     the client, and no username-based matching exists.
   • To grant/remove admin access, edit ADMIN_USER_IDS in this one file.
   • The frontend nav entry is cosmetic only; this file + the backend
     check are the real security boundary.
   ═══════════════════════════════════════════════════════════════════════ */

export const ADMIN_USER_IDS: readonly string[] = [
  "user_3J892ECTCiSntZpIwnKC4jvO56u", // purakpratik17 (Purak)
];
