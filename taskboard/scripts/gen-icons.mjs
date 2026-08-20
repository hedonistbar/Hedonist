// One-off icon generator: renders the app mark to the PNG sizes the PWA
// manifest and iOS home-screen icon need. Re-run with `node scripts/gen-icons.mjs`
// if the mark changes; outputs are committed under public/icons.
//
// The mark is three rounded columns of different heights — a kanban board,
// abstracted to something that still reads at 40px on an iPhone home
// screen — on a gradient drawn from Pantone's 2026 season palette
// (Alexandrite → Burnished Lilac), with a soft highlight near the top
// echoing the app's own "liquid glass" surfaces.
import sharp from "sharp";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(__dirname, "../public/icons");
mkdirSync(outDir, { recursive: true });

function svg({ size, padding = 0 }) {
  const inner = size - padding * 2;
  const s = (n) => padding + (n / 100) * inner; // percent-of-inner -> absolute coord
  const bars = [
    { x: 22, w: 14.5, top: 46, bottom: 72 }, // short
    { x: 42.5, w: 14.5, top: 28, bottom: 72 }, // tall
    { x: 63, w: 14.5, top: 38, bottom: 72 }, // medium
  ];
  const barRects = bars
    .map(
      (b) =>
        `<rect x="${s(b.x)}" y="${s(b.top)}" width="${(b.w / 100) * inner}" height="${((b.bottom - b.top) / 100) * inner}" rx="${(b.w / 100) * inner * 0.42}" fill="#f7f3ec"/>`,
    )
    .join("\n  ");

  return `
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1d6e6b"/>
      <stop offset="100%" stop-color="#8a6f9c"/>
    </linearGradient>
    <radialGradient id="hl" cx="30%" cy="18%" r="55%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.32"/>
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${size}" height="${size}" fill="url(#g)"/>
  <rect x="${padding}" y="${padding}" width="${inner}" height="${inner}" rx="${inner * 0.24}" fill="url(#g)"/>
  <rect x="${padding}" y="${padding}" width="${inner}" height="${inner}" rx="${inner * 0.24}" fill="url(#hl)"/>
  ${barRects}
</svg>`;
}

const targets = [
  { file: "icon-192.png", size: 192, padding: 0 },
  { file: "icon-512.png", size: 512, padding: 0 },
  { file: "icon-maskable-512.png", size: 512, padding: 64 }, // safe-zone margin for maskable icons
  { file: "apple-touch-icon.png", size: 180, padding: 0 },
];

for (const t of targets) {
  const buf = Buffer.from(svg(t));
  await sharp(buf).png().toFile(path.join(outDir, t.file));
  console.log(`wrote ${t.file}`);
}
