// Drag-and-drop reordering: on drop, the caller builds the new ordered id
// list for whatever changed (a list's cards, or the board's lists) and this
// re-persists sequential integer positions for exactly those ids. Simple and
// correct at personal-board scale — no fractional-index bookkeeping needed.

/** Where to insert a dragged item among vertically-stacked siblings, based on pointer Y. */
export function dropIndexFromPointer(
  container: HTMLElement,
  itemSelector: string,
  clientY: number,
): number {
  const items = Array.from(container.querySelectorAll<HTMLElement>(itemSelector));
  let index = items.length;
  for (let i = 0; i < items.length; i++) {
    const rect = items[i].getBoundingClientRect();
    if (clientY < rect.top + rect.height / 2) {
      index = i;
      break;
    }
  }
  return index;
}

/** Where to insert a dragged item among horizontally-laid-out siblings, based on pointer X. */
export function dropIndexFromPointerX(
  container: HTMLElement,
  itemSelector: string,
  clientX: number,
): number {
  const items = Array.from(container.querySelectorAll<HTMLElement>(itemSelector));
  let index = items.length;
  for (let i = 0; i < items.length; i++) {
    const rect = items[i].getBoundingClientRect();
    if (clientX < rect.left + rect.width / 2) {
      index = i;
      break;
    }
  }
  return index;
}
