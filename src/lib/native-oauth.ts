import type { OAuthTransport } from "@clerk/shared/types";

/**
 * Native OAuth transport for the Android (Capacitor) build.
 *
 * Problem this solves: inside the Capacitor WebView the app origin is
 * `https://localhost`, so by default Clerk's OAuth flow redirects the system
 * browser back to `localhost/sso-callback` → ERR_CONNECTION_REFUSED on the phone.
 *
 * Fix: register an OAuth transport with ClerkProvider. When set, Clerk uses
 * `getRedirectUrl()` as the FAPI `redirect_url` (the `studynotebook://sso-callback`
 * deep link registered in AndroidManifest.xml and in the Clerk Dashboard) and
 * calls `open()` instead of navigating the WebView document. The OS routes the
 * provider's redirect back into the app, Capacitor fires `appUrlOpen`, and
 * NativeAuthBridge hands the URL to `clerk.handleRedirectCallback()`.
 *
 * Web builds never use this — it is only passed to ClerkProvider when
 * `isNative()` is true, so browser login is untouched.
 */

/* ─── Single-consumer guard for auth deep links ──────────────────────────

   Clerk's OAuth `transfer` token is SINGLE-USE. Both the OAuth transport
   (while a sign-in window is open) and the NativeAuthBridge safety net
   listen on `appUrlOpen`; if both call `handleRedirectCallback` for the
   same URL, one consumes the transfer token and the other fails — the
   session never activates and the app buffers forever after returning
   from Google.

   The guard makes each callback URL single-consumer: the transport claims
   it first while it's waiting; the bridge only handles URLs that arrive
   when no transport is waiting (cold-start relaunch).
   ────────────────────────────────────────────────────────────────────── */

let transportWaiting = false;
const processedAuthUrls = new Set<string>();

/** True if this exact URL has not been processed yet (claims it atomically). */
export function claimAuthCallback(url: string): boolean {
  if (processedAuthUrls.has(url)) return false;
  processedAuthUrls.add(url);
  // Keep the set bounded.
  if (processedAuthUrls.size > 20) {
    processedAuthUrls.delete(processedAuthUrls.values().next().value as string);
  }
  return true;
}

export function setTransportWaiting(waiting: boolean): void {
  transportWaiting = waiting;
}

/** Is the OAuth transport currently waiting for a callback? */
export function transportOwnsCallback(): boolean {
  return transportWaiting;
}

export function createNativeOAuthTransport(): OAuthTransport {
  return {
    getRedirectUrl: () => "studynotebook://sso-callback",

    open: async (url: URL) => {
      // Defensive guard: Clerk's Browser.open target must always be an
      // https:// URL (the Accounts/FAPI authorize page). If a custom scheme
      // ever leaks into this slot the Android Custom Tabs WebView throws
      // "Invalid URL scheme — Please provide a URL with one of the following
      // schemes: https://, http://". Fall back to an in-WebView navigation
      // instead of crashing the flow.
      if (url.protocol !== "https:" && url.protocol !== "http:") {
        console.error(
          "[native-oauth] refusing to open non-https URL in system browser:",
          url.toString(),
        );
        window.location.href = url.toString();
        return { callbackUrl: url.toString() };
      }

      const { Browser } = await import("@capacitor/browser");
      const { App } = await import("@capacitor/app");

      // Wait for the deep link that closes the loop. Resolving removes
      // the appUrlOpen listener; the Browser plugin closes the tab.
      return new Promise<{ callbackUrl: string }>((resolve, reject) => {
        let handle: { remove: () => Promise<void> } | null = null;
        let done = false;
        transportWaiting = true;
        void App.addListener("appUrlOpen", (event) => {
          const u = new URL(event.url);
          const isAuthCallback =
            u.searchParams.has("transfer") ||
            u.searchParams.has("verified") ||
            u.searchParams.has("error_code") ||
            u.searchParams.has("error_description");
          if (!isAuthCallback || done) return;
          if (!claimAuthCallback(event.url)) return;
          done = true;
          transportWaiting = false;
          void handle?.remove();
          void Browser.close().catch(() => {});
          resolve({ callbackUrl: event.url });
        }).then((h) => {
          if (done) void h.remove();
          else handle = h;
        });

        void Browser.open({ url: url.toString() }).catch((err: unknown) => {
          if (!done) {
            done = true;
            transportWaiting = false;
            void handle?.remove();
            reject(err instanceof Error ? err : new Error(String(err)));
          }
        });
      });
    },
  };
}
