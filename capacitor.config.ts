import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Capacitor configuration — Android wrapper for Learnova.
 *
 * The web bundle (vite build -> dist/) is served from https://local.app/
 * inside the native WebView, so Clerk and Convex treat it as a normal
 * HTTPS origin (no insecure localhost hacks).
 */
const config: CapacitorConfig = {
  appId: "com.studynotebook.ai",
  appName: "Learnova",
  webDir: "dist",
  android: {
    // Required for Google sign-in popups and Clerk's Account Portal to work
    // inside the Android WebView. This allowlist is not a security hole:
    // the WebView still runs your own bundle; it only permits navigating
    // to these trusted first-party/trusted-provider domains.
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false,
  },
  server: {
    androidScheme: "https",
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      launchAutoHide: true,
      backgroundColor: "#faf7ef",
      androidScaleType: "CENTER_CROP",
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: false,
      layoutName: "launch_screen",
    },
  },
};

export default config;
