import { useState, type FormEvent } from "react";
import { supabase } from "../lib/supabase";

export function AuthScreen() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmNotice, setConfirmNotice] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setConfirmNotice(false);

    if (mode === "signin") {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) setError(signInError.message);
    } else {
      const { data, error: signUpError } = await supabase.auth.signUp({ email, password });
      if (signUpError) {
        setError(signUpError.message);
      } else if (!data.session) {
        // Email confirmation is on for this project — no session until they click the link.
        setConfirmNotice(true);
      }
    }
    setBusy(false);
  }

  return (
    <div className="center-screen">
      <div className="card" style={{ width: "100%", maxWidth: 380 }}>
        <h2>{mode === "signin" ? "Вход" : "Регистрация"}</h2>
        <p className="sub">Taskboard — личный таск-менеджер</p>

        {confirmNotice ? (
          <div className="notice">
            Проверьте почту {email} — отправили письмо для подтверждения. После подтверждения
            вернитесь сюда и войдите.
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="field">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="password">Пароль</label>
              <input
                id="password"
                type="password"
                required
                minLength={6}
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            {error && (
              <div className="error-text" style={{ marginBottom: 14 }}>
                {error}
              </div>
            )}

            <button className="btn btn-primary" type="submit" disabled={busy}>
              {busy ? "Секунду…" : mode === "signin" ? "Войти" : "Создать аккаунт"}
            </button>
          </form>
        )}

        <button
          className="link-btn"
          style={{ marginTop: 14 }}
          onClick={() => {
            setMode(mode === "signin" ? "signup" : "signin");
            setError(null);
            setConfirmNotice(false);
          }}
        >
          {mode === "signin" ? "Нет аккаунта? Зарегистрироваться" : "Уже есть аккаунт? Войти"}
        </button>
      </div>
    </div>
  );
}
