import { useState } from "react";
import { getStoredTheme, setStoredTheme, type ThemePreference } from "../lib/theme";

const OPTIONS: { pref: ThemePreference; icon: string; label: string }[] = [
  { pref: "system", icon: "🌗", label: "Авто" },
  { pref: "light", icon: "☀️", label: "Светлая" },
  { pref: "dark", icon: "🌙", label: "Тёмная" },
  { pref: "girls", icon: "✨", label: "Girls" },
];

/** A segmented chip row, matching the design reference's THEME picker,
 * instead of a single icon button cycling through the options. The text
 * label collapses to just the icon on narrow screens (CSS) — three full
 * words don't fit next to the rest of the topbar's buttons on an iPhone. */
export function ThemeToggle() {
  const [pref, setPref] = useState<ThemePreference>(getStoredTheme());

  function choose(next: ThemePreference) {
    setStoredTheme(next);
    setPref(next);
  }

  return (
    <div className="theme-toggle" role="group" aria-label="Тема оформления">
      {OPTIONS.map((opt) => (
        <button
          key={opt.pref}
          type="button"
          className={`theme-toggle-chip${pref === opt.pref ? " active" : ""}`}
          onClick={() => choose(opt.pref)}
          title={opt.label}
        >
          <span className="theme-toggle-icon">{opt.icon}</span>
          <span className="theme-toggle-label">{opt.label}</span>
        </button>
      ))}
    </div>
  );
}
