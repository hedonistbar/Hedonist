import type { Card } from "./database.types";

export type DueBucket = "overdue" | "today" | "upcoming" | "someday";

export function formatDueDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

/** Groups an active (not done) card the way the reference Home screen
 * does: by calendar day relative to today, not just dueUrgency's
 * overdue/today/soon flag (which only flags the next couple of days). */
export function dueBucket(card: Card): DueBucket {
  if (!card.due_date) return "someday";
  const due = new Date(card.due_date);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfDueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate());
  if (startOfDueDay < startOfToday) return "overdue";
  if (startOfDueDay.getTime() === startOfToday.getTime()) return "today";
  return "upcoming";
}
