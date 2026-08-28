import { useEffect, useState, type FormEvent } from "react";
import { hasAnthropicApiKey, setAnthropicApiKey } from "../lib/ai";

export function AISettingsModal({ onClose }: { onClose: () => void }) {
  const [hasKey, setHasKey] = useState<boolean | null>(null);
  const [key, setKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    hasAnthropicApiKey().then(setHasKey);
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!key.trim()) return;
    setSaving(true);
    setError(null);
    const result = await setAnthropicApiKey(key.trim());
    setSaving(false);
    if (!result.ok) {
      setError(result.error ?? "Не удалось сохранить ключ.");
      return;
    }
    setKey("");
    setSaved(true);
    setHasKey(true);
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>✨ ИИ-ассистент</h2>
          <button className="icon-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        <p className="sub">
          Ключ один на всё приложение (и на вас, и на супругу) — используется ИИ-ассистентом внутри карточек. Возьмите
          его на{" "}
          <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener noreferrer">
            console.anthropic.com
          </a>{" "}
          (раздел API Keys). Хранится зашифрованным в Vault на сервере — не в самом приложении.
        </p>

        {hasKey === true && !saved && <p className="pill member">✓ ключ уже настроен</p>}
        {saved && <p className="pill member">✓ ключ сохранён</p>}

        {error && <div className="error-text">{error}</div>}

        <form className="field" onSubmit={handleSubmit}>
          <label htmlFor="anthropic-key">{hasKey ? "Заменить ключ" : "Anthropic API-ключ"}</label>
          <input
            id="anthropic-key"
            type="password"
            placeholder="sk-ant-…"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            autoComplete="off"
          />
          <button className="btn btn-primary" type="submit" disabled={saving || !key.trim()} style={{ marginTop: 8 }}>
            {saving ? "Сохраняем…" : "Сохранить"}
          </button>
        </form>
      </div>
    </div>
  );
}
