export type Urgency = "overdue" | "today" | "soon";

/** Red once due (today or overdue), yellow the day before, otherwise no flag. */
export function dueUrgency(dueDateIso: string | null, isDone: boolean): Urgency | null {
  if (!dueDateIso || isDone) return null;
  const due = new Date(dueDateIso);
  const now = new Date();
  if (due < now) return "overdue";

  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfDueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate());
  const dayDiff = Math.round((startOfDueDay.getTime() - startOfToday.getTime()) / 86400000);

  if (dayDiff <= 0) return "today";
  if (dayDiff === 1) return "soon";
  return null;
}
