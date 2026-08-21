// A brief upward-drifting sparkle burst — the Girls theme's "surprise"
// micro-interaction on completing a task. Deliberately not confetti/emoji:
// 6 small 4-point stars in teal/gold, rotating and fading over ~1s.
const STAR_PATH = "M6 0 L7.5 4.5 L12 6 L7.5 7.5 L6 12 L4.5 7.5 L0 6 L4.5 4.5 Z";
const STAR_COLORS = ["oklch(52% 0.06 195)", "oklch(72% 0.1 75)", "oklch(60% 0.05 195)", "oklch(78% 0.08 80)"];

export function isGirlsTheme(): boolean {
  return document.documentElement.dataset.theme === "girls";
}

/** Fire the burst at a viewport position — pass the triggering click's
 * clientX/clientY. No-ops outside the Girls theme. */
export function triggerSparkleBurst(x: number, y: number): void {
  if (!isGirlsTheme()) return;
  for (let i = 0; i < 6; i++) {
    const el = document.createElement("div");
    el.className = "sparkle-star";
    el.style.left = `${x + (i - 2.5) * 9}px`;
    el.style.top = `${y}px`;
    el.style.color = STAR_COLORS[i % STAR_COLORS.length];
    el.style.animationDelay = `${i * 0.05}s`;
    el.innerHTML = `<svg width="12" height="12" viewBox="0 0 12 12"><path d="${STAR_PATH}" fill="currentColor"/></svg>`;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1100);
  }
}
