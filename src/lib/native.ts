import { Capacitor } from "@capacitor/core";

/**
 * Native (Android) runtime helpers.
 *
 * On Android the web bundle runs inside the Capacitor WebView at the origin
 * https://local.app (see capacitor.config.ts), so Clerk and Convex treat it
 * as a normal HTTPS site. Only the OAuth "transfer" step needs deep-link
 * handling — see NativeAuthBridge.
 */
export const isNative = (): boolean => Capacitor.isNativePlatform();
