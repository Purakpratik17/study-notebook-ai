import { LegalShell, Section, ContactBlock } from "./LegalShell";
import { LEGAL } from "@/lib/legal";

export default function RefundPolicy() {
  return (
    <LegalShell
      title="Refund & Cancellation Policy"
      subtitle={`Last updated ${LEGAL.LAST_UPDATED}`}
    >
      <Section title="1. Who processes payments and refunds">
        <p>
          Chat+ subscriptions are purchased through{" "}
          {LEGAL.BILLING_PROVIDER}. Google is the merchant of record for these
          purchases: payments, cancellations and refunds are handled under{" "}
          <strong>Google Play's own policies</strong>, not directly by{" "}
          {LEGAL.APP_NAME}. We cannot manually refund, cancel or re-bill a
          Google Play transaction.
        </p>
      </Section>

      <Section title="2. Cancelling your subscription">
        <p>
          Cancelling stops future renewals — it does not refund past charges,
          and your Chat+ benefits stay active until the end of the period you
          already paid for. To cancel:
        </p>
        <ul className="list-disc gap-1 pl-5">
          <li>Open the Google Play Store app on your Android device.</li>
          <li>Tap your profile icon → <strong>Payments &amp; subscriptions</strong> → <strong>Subscriptions</strong>.</li>
          <li>Select your {LEGAL.APP_NAME} Chat+ subscription and follow the cancel steps.</li>
        </ul>
      </Section>

      <Section title="3. Requesting a refund">
        <p>
          For refund requests, eligibility windows and step-by-step
          instructions, use{" "}
          <strong>Google Play's refund process</strong> (Play Store → order
          history → report a problem, or Google Play's &ldquo;Request a
          refund&rdquo; page). Google decides refunds under its policies. If
          Google grants one, your entitlement simply expires — you keep
          whatever you paid for until then, and your chat data is never
          deleted because of a cancelled subscription.
        </p>
      </Section>

      <Section title="4. What happens to your data">
        <p>
          Cancelling or refunding Chat+ never deletes your messages,
          conversations or study data. You keep all free features; only the
          premium extras (long videos, file sharing, ad-free experience and
          chat customizations) stop when the paid period ends.
        </p>
      </Section>

      <Section title="5. Questions">
        <p>
          For billing questions about a Google Play charge, contact Google
          Play support. For anything else about your entitlement in the app,
          reach us below and we'll help.
        </p>
        <ContactBlock />
      </Section>
    </LegalShell>
  );
}
