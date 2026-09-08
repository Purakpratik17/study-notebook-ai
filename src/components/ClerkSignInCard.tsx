import { SignIn } from "@clerk/react-router";

/**
 * Clerk's prebuilt <SignIn> handles Google OAuth and email sign-in/sign-up
 * with persistent sessions out of the box. It is themed via the ClerkProvider
 * appearance (see main.tsx) to match the notebook palette.
 */
export function ClerkSignInCard() {
  return (
    <div className="paper-sheet relative px-2 py-2 sm:px-3 sm:py-3">
      <SignIn
        signUpUrl="/auth"
        fallbackRedirectUrl="/dashboard"
        appearance={{
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
            socialButtonsBlockButton: "border bg-paper hover:bg-accent",
            socialButtonsBlockButtonText: "font-medium",
            dividerLine: "bg-border",
            formFieldInput: "bg-paper",
            footerActionLink: "text-primary",
          },
        }}
      />
    </div>
  );
}
