import { useState } from "react";
import { getStoredTheme, setStoredTheme, type ThemePreference } from "../lib/theme";

const ORDER: ThemePreference[] = ["system", "light", "dark"];
const ICON: Record<ThemePreference, string> = { system: "🌗", light: "☀️", dark: "🌙" };
const LABEL: Record<ThemePreference, string> = {
  system: "Как в системе",
  light: "Светлая",
  dark: "Тёмная",
};

/** Cycles system → light → dark → system on each tap. */
export function ThemeToggle() {
  const [pref, setPref] = useState<ThemePreference>(getStoredTheme());

  function cycle() {
    const next = ORDER[(ORDER.indexOf(pref) + 1) % ORDER.length];
    setStoredTheme(next);
    setPref(next);
  }

  return (
    <button
      type="button"
      className="icon-btn theme-toggle"
      onClick={cycle}
      title={`Тема: ${LABEL[pref]} — нажмите, чтобы сменить`}
      aria-label={`Тема: ${LABEL[pref]}`}
    >
      {ICON[pref]}
    </button>
  );
}
