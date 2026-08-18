// One-off icon generator: renders an SVG monogram to the PNG sizes the PWA
// manifest and iOS home-screen icon need. Re-run with `node scripts/gen-icons.mjs`
// if the mark changes; outputs are committed under public/icons.
import sharp from "sharp";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(__dirname, "../public/icons");
mkdirSync(outDir, { recursive: true });

function svg({ size, padding = 0 }) {
  const inner = size - padding * 2;
  return `
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${size}" height="${size}" fill="#1A130E"/>
  <rect x="${padding}" y="${padding}" width="${inner}" height="${inner}" fill="#221A12"/>
  <text
    x="50%" y="53%"
    text-anchor="middle"
    dominant-baseline="middle"
    font-family="Georgia, 'Times New Roman', serif"
    font-weight="600"
    font-size="${inner * 0.56}"
    fill="#D68B4A"
  >H</text>
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
