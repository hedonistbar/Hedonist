export function initials(name: string | null): string {
  if (!name) return "?";
  const local = name.includes("@") ? name.split("@")[0] : name;
  const parts = local.split(/[.\s_-]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return local.slice(0, 2).toUpperCase();
}
