import { useEffect, useState, type FormEvent } from "react";
import {
  connectGoogleCalendar,
  disconnectGoogleCalendar,
  hasGoogleCalendarConnected,
  hasGoogleOauthConfigured,
  setGoogleOauthCredentials,
} from "../lib/googleCalendar";
import { SUPABASE_URL } from "../lib/supabase";

export function GoogleCalendarSettingsModal({ onClose }: { onClose: () => void }) {
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [connected, setConnected] = useState<boolean | null>(null);
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [saving, setSaving] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const redirectUri = `${SUPABASE_URL}/functions/v1/google-calendar-auth`;

  useEffect(() => {
    hasGoogleOauthConfigured().then(setConfigured);
    hasGoogleCalendarConnected().then(setConnected);
  }, []);

  async function handleSaveCredentials(e: FormEvent) {
    e.preventDefault();
    if (!clientId.trim() || !clientSecret.trim()) return;
    setSaving(true);
    setError(null);
    const result = await setGoogleOauthCredentials(clientId.trim(), clientSecret.trim());
    setSaving(false);
    if (!result.ok) {
      setError(result.error ?? "Не удалось сохранить.");
      return;
    }
    setClientId("");
    setClientSecret("");
    setConfigured(true);
  }

  async function handleConnect() {
    setConnecting(true);
    setError(null);
    const result = await connectGoogleCalendar();
    if (!result.ok) {
      setConnecting(false);
      setError(result.error ?? "Не удалось подключиться.");
    }
    // On success the page navigates away to Google — nothing left to do here.
  }

  async function handleDisconnect() {
    setConnecting(true);
    await disconnectGoogleCalendar();
    setConnected(false);
    setConnecting(false);
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>📅 Google Calendar</h2>
          <button className="icon-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        {configured === false && (
          <>
            <p className="sub">
              Разовая настройка на всё приложение (и на вас, и на супругу). Создайте OAuth-клиент в{" "}
              <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer">
                Google Cloud Console
              </a>{" "}
              (тип «Веб-приложение»), redirect URI —{" "}
              <code style={{ wordBreak: "break-all" }}>{redirectUri || "<ваш Supabase URL>/functions/v1/google-calendar-auth"}</code>.
              На экране согласия (OAuth consent screen) оставьте режим «Testing» и добавьте оба ваших email в тестовые
              пользователи — так не понадобится проходить проверку Google. Client ID/Secret хранятся зашифрованными в
              Vault на сервере.
            </p>
            {error && <div className="error-text">{error}</div>}
            <form className="field" onSubmit={handleSaveCredentials}>
              <label htmlFor="google-client-id">Client ID</label>
              <input
                id="google-client-id"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                autoComplete="off"
              />
              <label htmlFor="google-client-secret" style={{ marginTop: 10 }}>
                Client Secret
              </label>
              <input
                id="google-client-secret"
                type="password"
                value={clientSecret}
                onChange={(e) => setClientSecret(e.target.value)}
                autoComplete="off"
              />
              <button
                className="btn btn-primary"
                type="submit"
                disabled={saving || !clientId.trim() || !clientSecret.trim()}
                style={{ marginTop: 10 }}
              >
                {saving ? "Сохраняем…" : "Сохранить"}
              </button>
            </form>
          </>
        )}

        {configured === true && (
          <>
            <p className="sub">
              {connected
                ? "Ваш Google Calendar подключён — события показываются на вкладке «Календарь»."
                : "Подключите свой Google Calendar, чтобы видеть его события рядом с задачами."}
            </p>
            {error && <div className="error-text">{error}</div>}
            {connected ? (
              <button className="btn" onClick={handleDisconnect} disabled={connecting}>
                {connecting ? "Отключаем…" : "Отключить"}
              </button>
            ) : (
              <button className="btn btn-primary" onClick={handleConnect} disabled={connecting}>
                {connecting ? "Открываем Google…" : "Подключить Google Calendar"}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
