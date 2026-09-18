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
export function createNativeOAuthTransport(): OAuthTransport {
  return {
    getRedirectUrl: () => "studynotebook://sso-callback",
    open: async (url: URL) => {
      const { Browser } = await import("@capacitor/browser");
      const { App } = await import("@capacitor/app");

      // Wait for the deep link that closes the loop. Resolving removes
      // the appUrlOpen listener; the Browser plugin closes the tab.
      return new Promise<{ callbackUrl: string }>((resolve, reject) => {
        let handle: { remove: () => Promise<void> } | null = null;
        let done = false;
        void App.addListener("appUrlOpen", (event) => {
          const u = new URL(event.url);
          const isAuthCallback =
            u.searchParams.has("transfer") ||
            u.searchParams.has("verified") ||
            u.searchParams.has("error_code") ||
            u.searchParams.has("error_description");
          if (!isAuthCallback || done) return;
          done = true;
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
            void handle?.remove();
            reject(err instanceof Error ? err : new Error(String(err)));
          }
        });
      });
    },
  };
}
