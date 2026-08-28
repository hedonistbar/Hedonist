import { useEffect, useState } from "react";

/** Matches App.css's `@media (max-width: 680px)` breakpoint — the same
 * cutoff used to switch modals to bottom sheets etc. */
export const MOBILE_BREAKPOINT_PX = 680;

export function useIsMobile(): boolean {
  const query = `(max-width: ${MOBILE_BREAKPOINT_PX}px)`;
  const [isMobile, setIsMobile] = useState(() => window.matchMedia(query).matches);

  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = () => setIsMobile(mql.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [query]);

  return isMobile;
}
