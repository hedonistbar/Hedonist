export type ThemePreference = "system" | "light" | "dark";

const STORAGE_KEY = "ivchenko-theme";

export function getStoredTheme(): ThemePreference {
  const v = localStorage.getItem(STORAGE_KEY);
  return v === "light" || v === "dark" ? v : "system";
}

export function setStoredTheme(pref: ThemePreference): void {
  const root = document.documentElement;
  if (pref === "system") {
    localStorage.removeItem(STORAGE_KEY);
    delete root.dataset.theme;
  } else {
    localStorage.setItem(STORAGE_KEY, pref);
    root.dataset.theme = pref;
  }
}
