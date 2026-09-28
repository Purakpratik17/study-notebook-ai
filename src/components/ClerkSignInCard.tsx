import { SignIn } from "@clerk/react-router";

/**
 * Clerk's prebuilt <SignIn> handles email sign-in/sign-up with persistent
 * sessions out of the box. Themed via the shared notebook palette.
 *
 * The appearance object is declared at module scope: a new object identity
 * each render would remount Clerk's internal flow and could cancel
 * in-flight button interactions.
 */
const clerkAppearance = {
  variables: {
    colorPrimary: "var(--primary)",
    colorBackground: "transparent",
    colorForeground: "var(--foreground)",
    colorInput: "var(--paper)",
    colorBorder: "var(--border)",
    colorDanger: "var(--destructive)",
    borderRadius: "0.55rem",
  },
  elements: {
    card: "bg-transparent shadow-none border-0",
    rootBox: "w-full",
    formFieldInput: "bg-paper",
    footerActionLink: "text-primary",
  },
} as const;

export { clerkAppearance };

export function ClerkSignInCard() {
  return (
    <div className="paper-sheet relative px-2 py-2 sm:px-3 sm:py-3">
      <SignIn
        signUpUrl="/sign-up"
        fallbackRedirectUrl="/dashboard"
        appearance={clerkAppearance}
      />
    </div>
  );
}
