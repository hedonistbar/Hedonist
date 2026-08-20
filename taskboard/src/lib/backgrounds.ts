// Named board background presets — a fixed palette (like Trello's board
// colors) rather than arbitrary CSS or image upload, so every board looks
// intentional and there's no extra storage/security surface for uploads.
export type BackgroundId = (typeof BOARD_BACKGROUNDS)[number]["id"];

export const BOARD_BACKGROUNDS = [
  { id: "default", label: "По умолчанию", css: null },
  { id: "ocean", label: "Океан", css: "linear-gradient(160deg, #2f6fed, #12b8b0)" },
  { id: "sunset", label: "Закат", css: "linear-gradient(160deg, #ff8a5c, #e5484d)" },
  { id: "grape", label: "Виноград", css: "linear-gradient(160deg, #8b5cf6, #3b3a8f)" },
  { id: "forest", label: "Лес", css: "linear-gradient(160deg, #2f9e5b, #12572f)" },
  { id: "peach", label: "Персик", css: "linear-gradient(160deg, #ffb199, #ff7eb3)" },
  { id: "graphite", label: "Графит", css: "linear-gradient(160deg, #3a4a63, #12192a)" },
  { id: "gold", label: "Золото", css: "linear-gradient(160deg, #f5c453, #e08a1e)" },
] as const;

export function backgroundCss(id: string | null): string | null {
  return BOARD_BACKGROUNDS.find((b) => b.id === id)?.css ?? null;
}
