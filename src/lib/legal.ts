/* ═══════════════════════════════════════════════════════════════════════
   Cerevyn legal & business configuration — SINGLE SOURCE OF TRUTH.

   ⚠️ TODO (owner must fill in): every value marked `null` below is
   intentionally a placeholder. NOTHING here has been invented. Until the
   real values are provided, the legal pages render a clear
   "information to be provided" notice instead of fake details.

   Fill in:
   • OPERATOR_NAME / LEGAL_ENTITY — the person or company running Cerevyn
   • CONTACT_EMAIL / SUPPORT_EMAIL — real, monitored inboxes
   • JURISDICTION — country/state the operator is based in (affects which
     consumer-protection and privacy rules apply)
   • PRIVACY_CONTACT / DPO_EMAIL — only if a formal privacy contact exists

   Do NOT commit real personal data to a public repository; consider
   keeping addresses out of the app entirely and linking to a hosted
   policy page instead.
   ═══════════════════════════════════════════════════════════════════════ */

export const LEGAL = {
  APP_NAME: "Cerevyn",
  LAST_UPDATED: "October 2026",

  /** Operator/brand name shown as the responsible party. */
  OPERATOR_NAME: null as string | null,
  /** Registered legal entity, if Cerevyn is run by one (else null). */
  LEGAL_ENTITY: null as string | null,
  /** Primary contact email (privacy + legal questions). */
  CONTACT_EMAIL: null as string | null,
  /** Support email shown in Settings → Contact Support. */
  SUPPORT_EMAIL: null as string | null,
  /** Formal privacy contact / DPO, if one exists. */
  PRIVACY_CONTACT: null as string | null,
  /** Country (+ state/province) the operator is based in. */
  JURISDICTION: null as string | null,
  /** Postal address — only include if legally required for the operator. */
  ADDRESS: null as string | null,
  /** Minimum age policy. null = not yet decided by the owner. Common
   *  choices: 13 (US COPPA baseline), 14/16 (some GDPR jurisdictions).
   *  The sign-in flow renders an age notice once this is set. */
  MINIMUM_AGE: null as number | null,

  /** How purchases are billed — matches the actual implementation. */
  BILLING_PROVIDER: "Google Play Billing" as string,
  /** Chat+ prices are shown from the verified config (₹99 / ₹499) but the
   *  legal pages intentionally do not restate them — Google Play is the
   *  seller of record and shows the final localized price at checkout. */
} as const;

/** True when the owner has filled in enough contact info to show it. */
export function hasContactInfo(): boolean {
  return Boolean(LEGAL.CONTACT_EMAIL || LEGAL.SUPPORT_EMAIL);
}

/** Standard "this needs owner info" notice used across the legal pages. */
export const PLACEHOLDER_NOTICE =
  "The operator of this app has not yet provided the business/contact details for this section. This placeholder will be replaced with the real information once it is available.";
