export type MobileTab = "home" | "projects" | "calendar" | "profile";

const TABS: { id: MobileTab; label: string; icon: React.ReactNode }[] = [
  {
    id: "home",
    label: "Главная",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path d="M4 11.5 12 4l8 7.5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M6 10v9a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    id: "projects",
    label: "Доски",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <rect x="4" y="4" width="7" height="7" rx="1.5" strokeWidth="2" />
        <rect x="13" y="4" width="7" height="7" rx="1.5" strokeWidth="2" />
        <rect x="4" y="13" width="7" height="7" rx="1.5" strokeWidth="2" />
        <rect x="13" y="13" width="7" height="7" rx="1.5" strokeWidth="2" />
      </svg>
    ),
  },
  {
    id: "calendar",
    label: "Календарь",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <rect x="3.5" y="5" width="17" height="15" rx="2.5" strokeWidth="2" />
        <path d="M8 2v4M16 2v4M3.5 10h17" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: "profile",
    label: "Профиль",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <circle cx="12" cy="8" r="3.5" strokeWidth="2" />
        <path d="M4.5 20c1.5-4 4.5-6 7.5-6s6 2 7.5 6" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
  },
];

export function BottomTabBar({ tab, onChange }: { tab: MobileTab; onChange: (t: MobileTab) => void }) {
  return (
    <nav className="tab-bar" aria-label="Основная навигация">
      {TABS.map((t) => (
        <button
          key={t.id}
          type="button"
          className={`tab-bar-item${tab === t.id ? " active" : ""}`}
          onClick={() => onChange(t.id)}
        >
          <span className="tab-bar-icon">{t.icon}</span>
          <span className="tab-bar-label">{t.label}</span>
        </button>
      ))}
    </nav>
  );
}
