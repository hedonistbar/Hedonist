import { ThemeToggle } from "../../components/ThemeToggle";
import { initials } from "../../lib/initials";
import type { PushStatus } from "../../lib/push";

export function ProfileTab({
  email,
  pushStatus,
  pushBusy,
  onEnablePush,
  onOpenAiSettings,
  onSignOut,
}: {
  email: string | null;
  pushStatus: PushStatus;
  pushBusy: boolean;
  onEnablePush: () => void;
  onOpenAiSettings: () => void;
  onSignOut: () => void;
}) {
  return (
    <div className="mobile-tab-content">
      <div className="mobile-tab-header">
        <h1 className="display-title" style={{ fontSize: 32 }}>
          Профиль
        </h1>
        <div className="display-subtitle">Аккаунт и настройки</div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 14, margin: "18px 0 22px" }}>
        <span className="profile-avatar">{initials(email)}</span>
        <div>
          <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 21, fontWeight: 700 }}>
            {email ?? "—"}
          </div>
          <div className="sub" style={{ margin: 0 }}>
            Ivchenko Hub
          </div>
        </div>
      </div>

      <div className="section-label">Внешний вид</div>
      <div className="info-card" style={{ padding: "13px 14px" }}>
        <ThemeToggle />
      </div>

      <div className="section-label">Настройки</div>
      <div className="info-card">
        <div className="info-row">
          <span className="info-row-label">Уведомления</span>
          {pushStatus === "subscribed" ? (
            <span className="info-row-value-group" style={{ color: "var(--success)", fontWeight: 600 }}>
              Включены
            </span>
          ) : pushStatus === "unsupported" ? (
            <span className="info-row-label">Не поддерживаются</span>
          ) : (
            <button className="text-link-muted" onClick={onEnablePush} disabled={pushBusy}>
              {pushBusy ? "…" : pushStatus === "denied" ? "Заблокированы" : "Включить"}
            </button>
          )}
        </div>
        <div className="info-row">
          <span className="info-row-label">ИИ-ассистент</span>
          <button className="text-link-muted" onClick={onOpenAiSettings}>
            Настроить ключ
          </button>
        </div>
      </div>

      <div className="info-card" style={{ marginTop: 20 }}>
        <button className="info-row" style={{ width: "100%", border: "none", background: "none", cursor: "pointer" }} onClick={onSignOut}>
          <span className="text-link-danger">Выйти</span>
        </button>
      </div>
    </div>
  );
}
