import { supabase } from "./supabase";

// Board background presets, built on Pantone's 2026 palette (Color of the
// Year "Cloud Dancer" 11-4201, plus the season's companion hues — Burnished
// Lilac, Alexandrite, Acacia, Mandarin Orange, Burnt Sienna). Each preset
// layers several radial gradients into a "mesh" rather than a flat two-color
// linear gradient, which is what actually reads as considered rather than
// a default CSS demo.
export type BackgroundId = (typeof BOARD_BACKGROUNDS)[number]["id"];

const CLOUD_DANCER = "#efe9df";
const BURNISHED_LILAC = "#ac97ba";
const ALEXANDRITE = "#1d6e6b";
const ACACIA = "#c9d257";
const MANDARIN = "#ef7238";
const BURNT_SIENNA = "#ad5a35";

export const BOARD_BACKGROUNDS = [
  { id: "default", label: "По умолчанию", kind: "flat", css: null },
  {
    id: "cloud-dancer",
    label: "Облачность",
    kind: "mesh",
    css: `radial-gradient(at 18% 22%, ${BURNISHED_LILAC}55 0px, transparent 55%), radial-gradient(at 85% 15%, ${ALEXANDRITE}33 0px, transparent 55%), radial-gradient(at 25% 90%, ${CLOUD_DANCER} 0px, transparent 60%), linear-gradient(165deg, #f7f4ee, #e4ddd0)`,
  },
  {
    id: "alexandrite",
    label: "Александрит",
    kind: "mesh",
    css: `radial-gradient(at 15% 20%, ${ALEXANDRITE} 0px, transparent 55%), radial-gradient(at 85% 10%, ${BURNISHED_LILAC}aa 0px, transparent 50%), radial-gradient(at 80% 90%, ${ACACIA}55 0px, transparent 50%), linear-gradient(165deg, #123a38, #0a1f1e)`,
  },
  {
    id: "burnished-lilac",
    label: "Лиловый дым",
    kind: "mesh",
    css: `radial-gradient(at 20% 15%, ${BURNISHED_LILAC} 0px, transparent 55%), radial-gradient(at 85% 25%, ${CLOUD_DANCER}88 0px, transparent 50%), radial-gradient(at 70% 90%, ${ALEXANDRITE}66 0px, transparent 55%), linear-gradient(165deg, #4a3a58, #241c2e)`,
  },
  {
    id: "mandarin",
    label: "Мандарин",
    kind: "mesh",
    css: `radial-gradient(at 18% 20%, ${MANDARIN} 0px, transparent 55%), radial-gradient(at 85% 15%, ${ACACIA}cc 0px, transparent 50%), radial-gradient(at 75% 95%, ${BURNT_SIENNA} 0px, transparent 55%), linear-gradient(165deg, #4a2416, #2a140b)`,
  },
  {
    id: "acacia",
    label: "Акация",
    kind: "mesh",
    css: `radial-gradient(at 15% 15%, ${ACACIA} 0px, transparent 55%), radial-gradient(at 85% 20%, ${ALEXANDRITE} 0px, transparent 55%), radial-gradient(at 25% 90%, ${CLOUD_DANCER}88 0px, transparent 55%), linear-gradient(165deg, #1c2a1e, #0e1712)`,
  },
  {
    id: "burnt-sienna",
    label: "Терракота",
    kind: "mesh",
    css: `radial-gradient(at 20% 20%, ${BURNT_SIENNA} 0px, transparent 55%), radial-gradient(at 85% 15%, ${MANDARIN}cc 0px, transparent 55%), radial-gradient(at 75% 90%, ${BURNISHED_LILAC}66 0px, transparent 50%), linear-gradient(165deg, #341a10, #1c0d08)`,
  },
  {
    id: "graphite",
    label: "Графит",
    kind: "mesh",
    css: `radial-gradient(at 20% 15%, ${ALEXANDRITE}55 0px, transparent 55%), radial-gradient(at 85% 85%, ${CLOUD_DANCER}33 0px, transparent 55%), linear-gradient(165deg, #383c46, #14161c)`,
  },
  // Flat single-color swatches — the rest of the season's Pantone 2026
  // palette that doesn't need a mesh treatment to read as intentional.
  { id: "flat-cloud-dancer", label: "Cloud Dancer", kind: "flat", css: "#efe9df" },
  { id: "flat-burnished-lilac", label: "Burnished Lilac", kind: "flat", css: "#ac97ba" },
  { id: "flat-alexandrite", label: "Alexandrite", kind: "flat", css: "#1d6e6b" },
  { id: "flat-acacia", label: "Acacia", kind: "flat", css: "#c9d257" },
  { id: "flat-mandarin", label: "Mandarin Orange", kind: "flat", css: "#ef7238" },
  { id: "flat-muskmelon", label: "Muskmelon", kind: "flat", css: "#e8926a" },
  { id: "flat-amethyst-orchid", label: "Amethyst Orchid", kind: "flat", css: "#8e5ba6" },
  { id: "flat-marina", label: "Marina", kind: "flat", css: "#4a7a9e" },
  { id: "flat-lyons-blue", label: "Lyons Blue", kind: "flat", css: "#1f4a5c" },
  { id: "flat-shale-green", label: "Shale Green", kind: "flat", css: "#6b8a6f" },
] as const;

export function backgroundCss(id: string | null): string | null {
  return BOARD_BACKGROUNDS.find((b) => b.id === id)?.css ?? null;
}

export const BACKGROUNDS_BUCKET = "board-backgrounds";

/** Uploads a custom board background photo and returns its storage path. */
export async function uploadBoardBackgroundImage(
  boardId: string,
  file: File,
): Promise<{ path: string | null; error?: string }> {
  const path = `${boardId}/${crypto.randomUUID()}-${file.name}`;
  const { error } = await supabase.storage.from(BACKGROUNDS_BUCKET).upload(path, file);
  if (error) return { path: null, error: error.message };
  return { path };
}

/** A background photo's bucket is private, so the client needs a signed URL
 * (not a public one) to actually render it. */
export async function getBoardBackgroundImageUrl(path: string): Promise<string | null> {
  const { data } = await supabase.storage.from(BACKGROUNDS_BUCKET).createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
}
