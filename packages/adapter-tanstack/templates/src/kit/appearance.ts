// Smithable app kit: the app's appearance (System, Light, Dark). The visitor's choice is kept in
// this browser; System follows the device. It is resolved on <html data-appearance> before the
// first paint (the root route runs APPEARANCE_SCRIPT in the page's head), so no page shows a
// flash of the other mode; the theme's dark variables and Tailwind's dark: variant follow it.

export type Appearance = "system" | "light" | "dark";

const KEY = "appearance";

/** Shows the chosen mode, now and whenever the device, another tab or the picker changes it. */
function startAppearance() {
  const root = document.documentElement;
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  const show = () => {
    let chosen: string | null = null;
    try {
      chosen = window.localStorage.getItem("appearance");
    } catch {}
    const mode =
      chosen === "light" || chosen === "dark" ? chosen : media.matches ? "dark" : "light";
    root.dataset.appearance = mode;
    root.style.colorScheme = mode;
  };
  show();
  media.addEventListener("change", show);
  window.addEventListener("storage", show);
  window.addEventListener("sm-appearance", show);
}

/** The head's script: self-contained, so it runs before the app's code is loaded. */
export const APPEARANCE_SCRIPT = `(${startAppearance.toString()})()`;

/** The visitor's choice as kept; System when none was made or the browser keeps nothing. */
export function storedAppearance(): Appearance {
  try {
    const chosen = window.localStorage.getItem(KEY);
    return chosen === "light" || chosen === "dark" ? chosen : "system";
  } catch {
    return "system";
  }
}

/** Keeps the choice (System forgets it) and shows it at once. */
export function chooseAppearance(choice: Appearance) {
  try {
    if (choice === "system") window.localStorage.removeItem(KEY);
    else window.localStorage.setItem(KEY, choice);
  } catch {}
  window.dispatchEvent(new Event("sm-appearance"));
}
