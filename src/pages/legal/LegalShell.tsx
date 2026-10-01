import { NotebookPen } from "lucide-react";
import { Link } from "react-router";
import { LEGAL, PLACEHOLDER_NOTICE, hasContactInfo } from "@/lib/legal";

/**
 * Shared shell for the legal pages. Notebook-styled to match Cerevyn —
 * not a generic legal site. All pages are public (no auth required) so
 * they can be linked from sign-up, the Play Store listing, and support.
 */
export function LegalShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex w-full max-w-3xl items-center justify-between px-4 py-5">
        <Link to="/" className="flex items-center gap-2">
          <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
            <NotebookPen className="size-5" />
          </span>
          <span className="text-base font-bold tracking-tight">
            {LEGAL.APP_NAME}
            <span className="annotation ml-1.5 text-xs font-normal">ai</span>
          </span>
        </Link>
        <Link
          to="/settings"
          className="rounded-lg border bg-card px-3 py-1.5 text-xs font-semibold hover:bg-accent"
        >
          Back to Settings
        </Link>
      </header>
      <main className="mx-auto w-full max-w-3xl px-4 pb-20">
        <h1 className="text-3xl font-black tracking-tight">{title}</h1>
        <p className="annotation mt-1 text-sm">{subtitle}</p>
        <div className="paper-sheet mt-6 flex flex-col gap-5 px-6 py-7 text-sm leading-relaxed md:px-8">
          {children}
        </div>
      </main>
      <footer className="border-t bg-card/60 py-6 text-center text-xs text-muted-foreground">
        {LEGAL.APP_NAME} — study smart, level up daily. ·{" "}
        <Link to="/privacy" className="underline hover:text-foreground">
          Privacy Policy
        </Link>{" "}
        ·{" "}
        <Link to="/terms" className="underline hover:text-foreground">
          Terms of Service
        </Link>
      </footer>
    </div>
  );
}

/** Renders a contact line only when real info exists; never invents one. */
export function ContactBlock() {
  return (
    <div className="flex flex-col gap-1">
      {LEGAL.OPERATOR_NAME && (
        <p>
          {LEGAL.APP_NAME} is operated by <strong>{LEGAL.OPERATOR_NAME}</strong>
          {LEGAL.LEGAL_ENTITY ? ` (${LEGAL.LEGAL_ENTITY})` : ""}.
        </p>
      )}
      {hasContactInfo() ? (
        <p>
          Contact:{" "}
          {LEGAL.CONTACT_EMAIL && (
            <a
              className="font-semibold underline"
              href={`mailto:${LEGAL.CONTACT_EMAIL}`}
            >
              {LEGAL.CONTACT_EMAIL}
            </a>
          )}
          {LEGAL.CONTACT_EMAIL && LEGAL.SUPPORT_EMAIL ? " · " : ""}
          {LEGAL.SUPPORT_EMAIL && (
            <a
              className="font-semibold underline"
              href={`mailto:${LEGAL.SUPPORT_EMAIL}`}
            >
              {LEGAL.SUPPORT_EMAIL}
            </a>
          )}
        </p>
      ) : (
        <p className="rounded-lg border border-dashed bg-card/60 px-4 py-3 text-xs text-muted-foreground">
          {PLACEHOLDER_NOTICE}
        </p>
      )}
    </div>
  );
}

export function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-base font-bold tracking-tight">{title}</h2>
      <div className="flex flex-col gap-2 text-muted-foreground">{children}</div>
    </section>
  );
}
