import { LegalShell, Section } from "./LegalShell";
import { LEGAL } from "@/lib/legal";

export default function TrackingPolicy() {
  return (
    <LegalShell
      title="Cookies & Tracking"
      subtitle={`Last updated ${LEGAL.LAST_UPDATED}`}
    >
      <Section title="1. No tracking cookies">
        <p>
          {LEGAL.APP_NAME} does <strong>not</strong> use tracking cookies,
          analytics pixels, session recorders or advertising cookies on the
          web. There is no third-party analytics SDK in the app.
        </p>
      </Section>

      <Section title="2. What IS stored in your browser">
        <ul className="list-disc gap-1 pl-5">
          <li>
            <strong>localStorage — app preferences.</strong> Your theme, sound,
            language, ad preference and similar settings are stored under a key
            scoped to your account so they survive a page reload. This storage
            is first-party, never sent anywhere, and clearing site data removes
            it.
          </li>
          <li>
            <strong>Session storage — sign-in state.</strong> Clerk, our
            authentication provider, keeps your session token in browser
            storage so you stay signed in. This is strictly necessary for the
            app to work; without it you would be signed out on every page.
          </li>
        </ul>
      </Section>

      <Section title="3. Android app">
        <p>
          The Android app is native and does not use browser cookies. It uses
          Google AdMob for ads, which may process device identifiers and ad
          interaction data under Google's policies, and Google Play Billing
          for subscriptions. Where required by law (for example in the EEA/UK),
          Google's consent form is shown before personalized ads are served,
          and you can revisit your choices via Google's privacy options entry
          point in the app.
        </p>
      </Section>

      <Section title="4. Managing this data">
        <p>
          You can clear all first-party app data at any time via your browser's
          &ldquo;clear site data&rdquo; option (signing you out and resetting
          preferences), and via your device's app settings on Android. Deleting
          your account removes your server-side data as described in the
          Privacy Policy.
        </p>
      </Section>
    </LegalShell>
  );
}
