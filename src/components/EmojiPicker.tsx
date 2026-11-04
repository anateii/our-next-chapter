import { createElement, useEffect, useRef, useState } from "react";
import { LoaderCircle } from "lucide-react";
import { iconOf, type MilestoneIcon } from "../helpers/ourspace";
import "./EmojiPicker.css";

// A milestone's mark: its emoji, or (for milestones from before emojis) its icon.
export function MilestoneMark({
  emoji,
  icon,
  size = 20,
}: Readonly<{ emoji?: string; icon: MilestoneIcon; size?: number }>) {
  if (emoji)
    return (
      <span className="emoji-mark" style={{ fontSize: Math.round(size * 1.1) }} aria-hidden="true">
        {emoji}
      </span>
    );
  // A fixed Lucide icon from the list in helpers/ourspace.ts.
  return createElement(iconOf(icon), { "aria-hidden": true, size });
}

// The full emoji set, drawn by the device's own emoji font (Apple's on
// iPhone and Mac). emoji-mart and its data (~430 KB) load only the first
// time a picker opens, so the rest of the app doesn't carry them.
type PickerModule = typeof import("emoji-mart");
let loading: Promise<[PickerModule, unknown]> | null = null;
const loadPicker = () =>
  (loading ??= Promise.all([import("emoji-mart"), import("@emoji-mart/data").then((m) => m.default)]));

// The app's colours as "r, g, b" for emoji-mart's CSS variables.
const palette = (dark: boolean) =>
  dark
    ? { accent: "143, 143, 242", background: "28, 27, 42", color: "237, 236, 247", border: "rgba(255, 255, 255, 0.08)" }
    : { accent: "91, 91, 214", background: "255, 255, 255", color: "28, 27, 46", border: "rgba(28, 27, 46, 0.08)" };

export default function EmojiPicker({
  onPick,
  onClose,
  onClear,
}: Readonly<{
  onPick: (emoji: string) => void;
  onClose: () => void;
  onClear?: () => void; // shown as "Use the default icon" when the milestone has an emoji
}>) {
  const host = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  // The picker is created once; keep it calling the latest handler.
  const pick = useRef(onPick);
  useEffect(() => {
    pick.current = onPick;
  }, [onPick]);

  useEffect(() => {
    let cancelled = false;
    loadPicker()
      .then(([{ Picker }, data]) => {
        if (cancelled || !host.current) return;
        const dark = document.documentElement.dataset.theme === "dark";
        const picker = new Picker({
          data,
          set: "native",
          theme: dark ? "dark" : "light",
          autoFocus: true,
          dynamicWidth: true,
          previewPosition: "none",
          skinTonePosition: "search",
          maxFrequentRows: 1,
          onEmojiSelect: (e: { native: string }) => pick.current(e.native),
        }) as unknown as HTMLElement;
        const c = palette(dark);
        picker.style.setProperty("--rgb-accent", c.accent);
        picker.style.setProperty("--rgb-background", c.background);
        picker.style.setProperty("--rgb-color", c.color);
        picker.style.setProperty("--color-border", c.border);
        picker.style.setProperty("--font-family", "var(--font-sans)");
        picker.style.setProperty("--border-radius", "14px");
        picker.style.setProperty("--shadow", "none");
        host.current.replaceChildren(picker);
        setState("ready");
      })
      .catch((err) => {
        console.error("Loading the emoji picker failed:", err);
        if (!cancelled) setState("error");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div
      className="emoji-picker"
      onKeyDown={(e) => {
        // Escape closes just the picker, not the dialog around it.
        if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          onClose();
        }
        // Enter picks the highlighted emoji; it mustn't also submit the form.
        if (e.key === "Enter") e.preventDefault();
      }}
    >
      {state === "loading" && (
        <p className="emoji-picker-status" role="status">
          <LoaderCircle className="spin" aria-hidden="true" size={18} /> Loading emojis…
        </p>
      )}
      {state === "error" && (
        <p className="emoji-picker-status" role="alert">
          Couldn't load the emojis. Check your connection and try again.
        </p>
      )}
      <div ref={host} />
      {onClear && state === "ready" && (
        <button type="button" className="link-btn emoji-picker-clear" onClick={onClear}>
          Use the default icon
        </button>
      )}
    </div>
  );
}
