import { BOARD_BACKGROUNDS } from "./backgrounds";

// Neither boards nor lists have their own color field, so derive a stable
// swatch per id from the same Pantone flat palette backgrounds already
// use — an item always shows the same color without a schema change.
const SWATCH_COLORS = BOARD_BACKGROUNDS.filter((b) => b.kind === "flat" && b.css).map((b) => b.css!);

export function swatchColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return SWATCH_COLORS[hash % SWATCH_COLORS.length];
}
