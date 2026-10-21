// Smithable app kit: the appearance picker (System, Light, Dark), in the menu and a public
// page's footer. The choice is the browser's (src/kit/appearance.ts).
import { useEffect, useState } from "react";
import { type Appearance, chooseAppearance, storedAppearance } from "./appearance";
import { w } from "./words";

export function AppearancePicker({ className }: { className?: string }) {
  const [choice, setChoice] = useState<Appearance>("system");
  // Read once in the browser: the server cannot know it.
  useEffect(() => setChoice(storedAppearance()), []);
  return (
    <label data-part="appearance" className={className}>
      <span>{w.appearance}</span>
      <select
        value={choice}
        onChange={(event) => {
          const next = event.target.value as Appearance;
          setChoice(next);
          chooseAppearance(next);
        }}
        className="ml-2 rounded-md border bg-transparent px-1.5 py-0.5 text-current"
      >
        <option value="system">{w.appearanceSystem}</option>
        <option value="light">{w.appearanceLight}</option>
        <option value="dark">{w.appearanceDark}</option>
      </select>
    </label>
  );
}
