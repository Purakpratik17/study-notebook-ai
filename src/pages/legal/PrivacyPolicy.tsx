import { LegalShell, Section, ContactBlock } from "./LegalShell";
import { LEGAL } from "@/lib/legal";

/**
 * Privacy Policy — describes ONLY what the code actually processes.
 * Verified against the codebase (2026-10):
 *  • Clerk authentication (email / email-OTP sign-in)
 *  • Convex backend storing study data keyed to the Clerk user id
 *  • NVIDIA-hosted AI model for notes/quiz/tutor generation (prompt text
 *    is sent server-side; the API key never leaves the Convex backend)
 *  • Google AdMob ads (Android only; web loads no ad code)
 *  • Google Play Billing for Chat+ (purchase tokens verified server-side)
 *  • localStorage for per-user UI preferences on this device
 *  • Convex file storage for chat media (participants-only access)
 *  • No analytics SDKs, no marketing emails, no tracking pixels.
 */
export default function PrivacyPolicy() {
  return (
    <LegalShell
      title="Privacy Policy"
      subtitle={`Last updated ${LEGAL.LAST_UPDATED}`}
    >
      <Section title="1. Who this policy covers">
        <p>
          This policy explains how {LEGAL.APP_NAME} (&ldquo;the app&rdquo;,
          &ldquo;we&rdquo;) handles information when you use the web app or the
          Android app. It describes only the data processing that actually
          happens in the app.
        </p>
      </Section>

      <Section title="2. Information we process">
        <ul className="list-disc gap-1 pl-5">
          <li>
            <strong>Account information.</strong> When you sign in we process
            your email address and basic profile name through Clerk, our
            authentication provider. Your account is identified inside the app
            by a Clerk user ID.
          </li>
          <li>
            <strong>Study content you create.</strong> AI study notes, your
            edits to them, personal notes, whiteboards, flashcards, practice
            sessions, quiz attempts, essays, projects, timetable entries and
            folders — stored on our backend (Convex) and tied to your account.
          </li>
          <li>
            <strong>Progress data.</strong> XP, level, streaks, quests,
            achievements, arcade high scores and study-time statistics.
          </li>
          <li>
            <strong>Social data.</strong> Your public profile (display name,
            username, bio, optional avatar, school/course/interests you choose
            to add), friend requests, friendships, group memberships and chat
            messages you send.
          </li>
          <li>
            <strong>Chat media.</strong> Images, videos and files you attach in
            chats are stored in Convex file storage. Access is restricted to
            the participants of that conversation, enforced server-side.
          </li>
          <li>
            <strong>AI requests.</strong> The text you type into AI features
            (topics, questions, essay prompts, tutor chats) and photos you
            snap for Snap &amp; Solve are sent to an AI model hosted on NVIDIA's
            cloud to generate your study material. The API key is kept
            server-side and is never shared with the model provider beyond the
            request itself.
          </li>
          <li>
            <strong>Purchase data.</strong> If you subscribe to Chat+ on
            Android, Google Play processes the payment. We receive and store
            the purchase token, product ID, order ID and expiry so we can
            verify and maintain your entitlement. We never see your payment
            card details.
          </li>
          <li>
            <strong>Advertising data (Android only).</strong> The Android app
            shows Google AdMob ads. Google may process device and ad
            interaction data under its own policies. The web version loads no
            ad code at all. We do not send your email, sign-in details, notes
            or study content to advertisers.
          </li>
          <li>
            <strong>Local preferences.</strong> Theme, sound, language and
            similar UI choices are stored in your browser's localStorage on
            this device, scoped to your account. Clearing your browser data
            removes them.
          </li>
        </ul>
      </Section>

      <Section title="3. What we do NOT do">
        <ul className="list-disc gap-1 pl-5">
          <li>We do not run analytics or tracking SDKs.</li>
          <li>We do not send marketing or promotional emails.</li>
          <li>We do not sell your personal data.</li>
          <li>We do not use traditional browser cookies for tracking; the
            only browser storage is the localStorage described above plus the
            session storage Clerk uses to keep you signed in.</li>
          <li>We do not collect your date of birth (see section 9).</li>
        </ul>
      </Section>

      <Section title="4. Third-party services">
        <ul className="list-disc gap-1 pl-5">
          <li><strong>Clerk</strong> — authentication (sign-in, sessions).</li>
          <li><strong>Convex</strong> — backend database, functions and file storage.</li>
          <li><strong>NVIDIA-hosted AI models</strong> — generation of notes, quizzes, essays and tutor answers.</li>
          <li><strong>Google AdMob</strong> — ads in the Android app only.</li>
          <li><strong>Google Play Billing</strong> — Chat+ subscriptions on Android.</li>
        </ul>
        <p>
          Each of these processes data under its own privacy policy when you
          interact with it.
        </p>
      </Section>

      <Section title="5. Data retention">
        <p>
          Your study content and progress are kept for as long as your account
          exists so the app can function. When you delete your account (see
          section 6) we delete or anonymize your account data as described
          there. Chat messages you sent to other people are removed as part of
          account deletion; messages other people sent to you remain in their
          conversations because they are that person's data too.
        </p>
      </Section>

      <Section title="6. Data deletion">
        <p>
          You can delete your account at any time in{" "}
          <strong>Settings → Account → Delete Account</strong>. Deletion
          removes your profile, study content, progress, friend relationships,
          conversations, media and entitlement records from our backend. This
          is permanent and cannot be undone.
        </p>
      </Section>

      <Section title="7. Your rights">
        <p>
          Depending on where you live, you may have rights to access, correct,
          export or delete your personal data, and to object to certain
          processing. The fastest way to exercise any of these is to delete
          your account in Settings, or to contact us (below) for anything else.
        </p>
      </Section>

      <Section title="8. Children">
        <p>
          {LEGAL.MINIMUM_AGE === null ? (
            <>
              The app is a study tool intended for students; it is not directed
              at young children. The owner of the app has not yet published a
              formal minimum age — an age notice will appear here once set. If
              you believe a child has created an account inappropriately,
              please contact us and we will remove it.
            </>
          ) : (
            <>
              You must be at least {LEGAL.MINIMUM_AGE} years old to create an
              account. If we learn that an account belongs to a child below
              that age, it will be removed.
            </>
          )}
        </p>
      </Section>

      <Section title="9. Security">
        <p>
          Authentication and all data access are enforced server-side: every
          backend function verifies your identity and only ever returns or
          modifies data belonging to you (or conversations you are a verified
          participant of). Secrets such as the AI API key and Google Play
          credentials are stored only in the server environment, never in the
          app.
        </p>
      </Section>

      <Section title="10. Changes to this policy">
        <p>
          If we change how the app processes data, we will update this page and
          the &ldquo;last updated&rdquo; date above. Material changes will also
          be announced in the app.
        </p>
      </Section>

      <Section title="11. Contact">
        <ContactBlock />
      </Section>
    </LegalShell>
  );
}
