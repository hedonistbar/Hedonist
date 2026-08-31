// Offline placeholder images (data: URIs) so the prototype never depends on
// network access to a third-party image host. Production discovery would
// pull real photos found on Google/Booking/Instagram/etc. per SPEC.md §8.
export function placeholderImage(label: string, color: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="320">
    <rect width="100%" height="100%" fill="${color}"/>
    <text x="50%" y="50%" font-family="sans-serif" font-size="24" fill="white"
      text-anchor="middle" dominant-baseline="middle">${label}</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
