import { useClerk } from "@clerk/react-router";
import { useEffect } from "react";
import { isNative } from "@/lib/native";
import {
  claimAuthCallback,
  transportOwnsCallback,
} from "@/lib/native-oauth";

/**
 * Mounted once inside <ClerkProvider> (web + native). On Android it:
 *
 * 1. Completes Clerk OAuth (Google) / email-verification redirects that
 *    return from the system browser via the `studynotebook://sso-callback`
 *    scheme (legacy scheme kept so existing Clerk OAuth redirects keep working)
 *    deep link. Capacitor fires `appUrlOpen`; the query params are handed to
 *    Clerk's `handleRedirectCallback()`, which validates the `transfer`
 *    value and activates the session in the WebView. No token exchange
 *    happens in the WebView — this is Clerk's documented native pattern
 *    (https://clerk.com/docs/guides/development/native-apps/overview).
 * 2. Maps the hardware/gesture back button to browser history, exiting the
 *    app only at the root.
 */
export function NativeAuthBridge() {
  const clerk = useClerk();

  useEffect(() => {
    if (!isNative()) return;

    let cleanupFns: Array<() => void> = [];
    let cancelled = false;

    (async () => {
      const { App } = await import("@capacitor/app");
      if (cancelled) return;

      const urlOpen = await App.addListener("appUrlOpen", (event) => {
        // The OAuth transport (see src/lib/native-oauth.ts) consumes the
        // primary auth callback while a sign-in window is open. This listener
        // is the safety net: it only handles callbacks that arrive when the
        // transport is NOT waiting (e.g. the app was killed mid-flow and
        // relaunched via the deep link). Clerk's transfer token is single-use,
        // so two consumers for the same URL would break sign-in — one would
        // consume it and the session would never activate (infinite spinner).
        const url = new URL(event.url);
        const isAuthCallback =
          url.searchParams.has("transfer") ||
          url.searchParams.has("verified") ||
          url.searchParams.has("error_code") ||
          url.searchParams.has("error_description");
        if (!isAuthCallback) return;
        if (transportOwnsCallback()) return; // transport will handle it
        if (!claimAuthCallback(event.url)) return; // already processed
        void clerk
          .handleRedirectCallback({
            signInForceRedirectUrl: "/dashboard",
            signUpForceRedirectUrl: "/dashboard",
          })
          .catch((err: unknown) => {
            console.error("[native-auth] redirect callback failed:", err);
          });
      });

      const backButton = await App.addListener("backButton", () => {
        if (window.history.length > 1) {
          window.history.back();
        } else {
          void App.exitApp();
        }
      });

      if (cancelled) {
        void urlOpen.remove();
        void backButton.remove();
        return;
      }
      cleanupFns = [
        () => void urlOpen.remove(),
        () => void backButton.remove(),
      ];
    })();

    return () => {
      cancelled = true;
      cleanupFns.forEach((fn) => fn());
    };
  }, [clerk]);

  return null;
}

/**
 * Route component for /sso-callback — finishes any OAuth/transfer flow that
 * Clerk redirected inside the WebView itself (e.g. email verification).
 */
export function SsoCallback() {
  const clerk = useClerk();

  useEffect(() => {
    void clerk
      .handleRedirectCallback({
        signInForceRedirectUrl: "/dashboard",
        signUpForceRedirectUrl: "/dashboard",
      })
      .catch((err: unknown) => {
        console.error("[auth] callback failed:", err);
        window.location.replace("/auth");
      });
  }, [clerk]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3">
        <div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <p className="annotation text-sm">finishing sign-in…</p>
      </div>
    </main>
  );
}
