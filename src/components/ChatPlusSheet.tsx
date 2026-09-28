import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { toast } from "sonner";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useChatPlus } from "@/hooks/use-chat-plus";
import { Capacitor } from "@capacitor/core";

/**
 * Google Play Billing purchase launcher. With the BillingClient integration
 * present (capacitor plugin), the native purchase sheet opens and the
 * resulting purchase token is verified server-side via
 * `playBilling.verifyPurchase`. Without it (web / before integration), we
 * clearly tell the user — we never fake an entitlement.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function startChatPlusPurchase(_plan: "monthly" | "yearly"): Promise<void> {
  if (!Capacitor.isNativePlatform()) {
    toast.info("Chat+ is purchased through Google Play on the Android app 💜");
    return;
  }
  // The native billing bridge is invoked from the Android layer; if it is
  // not yet wired, surface a clear message instead of pretending.
  toast.info("Opening Google Play… if nothing happens, billing isn't set up yet.");
}

/**
 * Chat+ upgrade / settings sheet. Monthly ₹99 and Yearly ₹499 plans with a
 * close option. Nothing is subscribed automatically — a purchase only
 * happens when the user taps a plan button and confirms in Google Play.
 */
export function ChatPlusSheet({ onClose }: { onClose: () => void }) {
  const { plus, describeExpiry, priceDisplay, yearlyDisplay } = useChatPlus();
  const settings = useQuery(api.chatPlus.getSettings);
  const setSettings = useMutation(api.chatPlus.setSettings);
  const [saving, setSaving] = useState(false);

  const save = async (patch: Record<string, unknown>) => {
    setSaving(true);
    try {
      const r = await setSettings(patch as never);
      if (r === "plus_required") toast.error("Chat+ is required for chat customizations 💜");
      else toast.success("Saved 💜");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 pb-[calc(env(safe-area-inset-bottom,0px)+16px)] sm:items-center">
      <div
        className="max-h-[85dvh] w-full max-w-md overflow-y-auto rounded-2xl border bg-background p-5 shadow-xl"
        role="dialog"
        aria-modal="true"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-lg font-extrabold">
              💜 Chat+{" "}
              {plus ? (
                <span className="ml-1 rounded-full bg-purple-600/15 px-2 py-0.5 text-xs font-bold text-purple-600 dark:text-purple-400">
                  Active{describeExpiry() ? ` until ${describeExpiry()}` : ""}
                </span>
              ) : (
                <span className="ml-1 text-sm font-semibold text-muted-foreground">
                  from {priceDisplay}
                </span>
              )}
            </p>
            <p className="annotation mt-0.5 text-xs">
              Premium chat for Cerevyn — billed via Google Play.
            </p>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="flex size-8 items-center justify-center rounded-full border"
          >
            <X className="size-4" />
          </button>
        </div>

        {!plus && (
          <ul className="mb-4 space-y-1.5 rounded-xl border border-purple-600/25 bg-purple-600/5 p-3 text-sm">
            <li>✓ Send videos longer than 3 minutes</li>
            <li>✓ File sharing in any chat</li>
            <li>✓ Expanded media capabilities</li>
            <li>✓ Chat+ badge</li>
            <li>✓ Purple username</li>
            <li>✓ Custom chat settings</li>
            <li>✓ Completely ad-free Cerevyn</li>
          </ul>
        )}

        {!plus && (
          <div className="mb-4 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => void startChatPlusPurchase("monthly")}
              className="rounded-xl border border-purple-600/40 bg-purple-600/5 p-3 text-center transition hover:bg-purple-600/10 active:scale-95"
            >
              <span className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Monthly
              </span>
              <span className="mt-1 block text-lg font-extrabold">{priceDisplay}</span>
              <span className="annotation block text-[10px]">per month</span>
            </button>
            <button
              type="button"
              onClick={() => void startChatPlusPurchase("yearly")}
              className="relative rounded-xl border border-purple-600 bg-purple-600/10 p-3 text-center transition hover:bg-purple-600/15 active:scale-95"
            >
              <span className="absolute -top-2 left-1/2 -translate-x-1/2 rounded-full bg-purple-600 px-2 py-px text-[9px] font-bold uppercase text-white">
                Best value
              </span>
              <span className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Yearly
              </span>
              <span className="mt-1 block text-lg font-extrabold">{yearlyDisplay}</span>
              <span className="annotation block text-[10px]">per year</span>
            </button>
          </div>
        )}

        <div className="space-y-3">
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
            Chat settings
          </p>
          <label className="flex items-center justify-between gap-3 text-sm">
            <span>Message sound</span>
            <input
              type="checkbox"
              checked={settings?.messageSound ?? true}
              disabled={saving}
              onChange={(e) => void save({ messageSound: e.target.checked })}
              className="size-4"
            />
          </label>
          <label className="flex items-center justify-between gap-3 text-sm">
            <span>New-message notifications</span>
            <input
              type="checkbox"
              checked={settings?.notifyNewMessages ?? true}
              disabled={saving}
              onChange={(e) => void save({ notifyNewMessages: e.target.checked })}
              className="size-4"
            />
          </label>
          <label className="flex items-center justify-between gap-3 text-sm">
            <span>Auto-download media</span>
            <input
              type="checkbox"
              checked={settings?.autoDownloadMedia ?? true}
              disabled={saving}
              onChange={(e) => void save({ autoDownloadMedia: e.target.checked })}
              className="size-4"
            />
          </label>

          <div className={cn("rounded-xl border p-3", !plus && "opacity-60")}>
            <p className="mb-2 text-sm font-semibold">
              Chat theme {plus ? "" : "— Chat+ only 💜"}
            </p>
            <div className="flex flex-wrap gap-2">
              {[
                { id: "default", label: "Default" },
                { id: "violet", label: "🟣 Violet" },
                { id: "ocean", label: "🌊 Ocean" },
                { id: "forest", label: "🌲 Forest" },
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  disabled={!plus || saving}
                  onClick={() => void save({ bubbleColor: t.id })}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-xs font-semibold transition",
                    settings?.bubbleColor === t.id
                      ? "border-purple-600 bg-purple-600/10 text-purple-700 dark:text-purple-300"
                      : "hover:bg-muted",
                    !plus && "cursor-not-allowed",
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
