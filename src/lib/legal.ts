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
  OPERATOR_NAME: "Purak Pratik",
  /** Registered legal entity, if Cerevyn is run by one (else null). */
  LEGAL_ENTITY: null,
  /** Primary contact email (privacy + legal questions). Owner-confirmed. */
  CONTACT_EMAIL: "purakpratik.cerevyn@gmail.com",
  /** Support email shown in Settings → Contact Support. Owner-confirmed. */
  SUPPORT_EMAIL: "purakpratik.cerevyn@gmail.com",
  /** Formal privacy contact / DPO, if one exists. */
  PRIVACY_CONTACT: null,
  /** Country (+ state/province) the operator is based in. */
  JURISDICTION: null,
  /** Postal address — only include if legally required for the operator. */
  ADDRESS: null,
  /** Minimum age policy. Owner-confirmed: 13. */
  MINIMUM_AGE: 13,

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
