import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import { supabase } from "./supabase";

// Public VAPID key — safe to ship client-side by design (it's how the push
// service verifies who a subscription belongs to, not a secret).
const VAPID_PUBLIC_KEY = "BG5NPfE5uIagPyVxqFL85xVyH5jbxhFX-OGyCf3S3zsKoOm1OyH09UtpvcxClf0FizczVsQQMq9l2oVIzPvkY28";

const isNative = Capacitor.isNativePlatform();

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

export function isPushSupported(): boolean {
  if (isNative) return true;
  return "serviceWorker" in navigator && "PushManager" in window;
}

export type PushStatus = "unsupported" | "denied" | "subscribed" | "unsubscribed";

export async function getPushStatus(): Promise<PushStatus> {
  if (!isPushSupported()) return "unsupported";

  if (isNative) {
    const { receive } = await PushNotifications.checkPermissions();
    if (receive === "denied") return "denied";
    if (receive !== "granted") return "unsubscribed";
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return "unsubscribed";
    const { count } = await supabase
      .from("native_push_tokens")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userData.user.id);
    return count && count > 0 ? "subscribed" : "unsubscribed";
  }

  if (Notification.permission === "denied") return "denied";
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  return sub ? "subscribed" : "unsubscribed";
}

/** Native path: APNs (iOS) / FCM (Android) via Capacitor, delivered through
 * the "registration" event rather than a returned value like the Web Push
 * subscribe() promise — wrap it in one. */
async function enableNativePush(): Promise<{ ok: boolean; error?: string }> {
  const permission = await PushNotifications.requestPermissions();
  if (permission.receive !== "granted") {
    return { ok: false, error: "Разрешение на уведомления не выдано." };
  }
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { ok: false, error: "Не авторизован." };
  const userId = userData.user.id;

  return new Promise((resolve) => {
    PushNotifications.addListener("registration", async (token) => {
      const { error } = await supabase.from("native_push_tokens").upsert(
        { user_id: userId, platform: Capacitor.getPlatform(), token: token.value },
        { onConflict: "user_id,token" },
      );
      resolve(error ? { ok: false, error: error.message } : { ok: true });
    });
    PushNotifications.addListener("registrationError", (err) => {
      resolve({ ok: false, error: err.error || "Не удалось зарегистрироваться для уведомлений." });
    });
    PushNotifications.register();
  });
}

export async function enablePush(): Promise<{ ok: boolean; error?: string }> {
  if (!isPushSupported()) {
    return { ok: false, error: "Push-уведомления не поддерживаются этим браузером." };
  }
  if (isNative) return enableNativePush();

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    return { ok: false, error: "Разрешение на уведомления не выдано." };
  }

  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
    });
  }

  const json = sub.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
    return { ok: false, error: "Не удалось получить push-подписку." };
  }

  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { ok: false, error: "Не авторизован." };

  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: userData.user.id,
      endpoint: json.endpoint,
      p256dh: json.keys.p256dh,
      auth_key: json.keys.auth,
    },
    { onConflict: "endpoint" },
  );
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function disablePush(): Promise<void> {
  if (!isPushSupported()) return;

  if (isNative) {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;
    await supabase.from("native_push_tokens").delete().eq("user_id", userData.user.id);
    return;
  }

  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (sub) {
    await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
    await sub.unsubscribe();
  }
}

/** Fire-and-forget ping to whoever a card just got assigned to. */
export function notifyCardAssigned(cardId: string) {
  supabase.functions.invoke("send-push", { body: { card_id: cardId } }).catch(() => {
    // best-effort — assignment itself already succeeded, a failed ping isn't fatal
  });
}
