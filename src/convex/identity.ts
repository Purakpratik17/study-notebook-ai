import { clerkUserFromIdentity } from "./data";

/** Minimal auth surface shared by queries, mutations and actions. */
type AuthCtx = {
  auth: {
    getUserIdentity: () => Promise<{
      subject: string;
      name?: string | null;
      givenName?: string | null;
      email?: string | null;
      pictureUrl?: string | null;
      issuer?: string | null;
    } | null>;
  };
};

/**
 * Resolve the signed-in user to a stable per-user id.
 *
 * Auth is Clerk-issued: Convex validates the JWT against the Clerk issuer
 * domain (see auth.config.ts), and `getUserIdentity()` exposes the Clerk
 * user's `sub` claim as `identity.subject`. All study data is keyed on this
 * id, so each account has fully isolated data.
 */
export async function requireUserId(ctx: AuthCtx): Promise<string> {
  const identity = await ctx.auth.getUserIdentity();
  const user = clerkUserFromIdentity(identity);
  if (!user) {
    throw new Error(
      "UNAUTHENTICATED: sign in with Clerk to access your study data",
    );
  }
  return user.externalId;
}

export async function getOptionalUserId(ctx: AuthCtx): Promise<string | null> {
  const identity = await ctx.auth.getUserIdentity();
  const user = clerkUserFromIdentity(identity);
  return user?.externalId ?? null;
}
