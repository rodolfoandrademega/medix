import { api } from "./api";
export function supportsPush() {
  return typeof window !== "undefined" && window.isSecureContext && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}
async function registration() {
  await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  return navigator.serviceWorker.ready;
}
export async function enablePush(publicKey: string, advance: number) {
  if (!supportsPush()) throw new Error("Este dispositivo não oferece push. No iPhone/iPad, instale a Medix na Tela de Início e abra o app instalado.");
  // Solicitação iniciada diretamente pelo clique, necessária no iOS.
  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("Permita as notificações nas configurações do dispositivo. Os avisos do sino continuam disponíveis.");
  const worker = await registration();
  const bytes = Uint8Array.from(atob(publicKey.replace(/-/g, "+").replace(/_/g, "/")), char => char.charCodeAt(0));
  const subscription = await worker.pushManager.getSubscription() || await worker.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: bytes });
  try { await api("/v1/push/subscriptions", { method: "POST", body: JSON.stringify({ subscription: subscription.toJSON(), advance }) }); }
  catch (error) { await subscription.unsubscribe(); throw error; }
}
export async function syncPush(advance: number) {
  if (!supportsPush()) return;
  const worker = await navigator.serviceWorker.getRegistration("/");
  const subscription = await worker?.pushManager.getSubscription();
  if (!subscription) throw new Error("Ative novamente as notificações neste dispositivo.");
  await api("/v1/push/subscriptions", { method: "POST", body: JSON.stringify({ subscription: subscription.toJSON(), advance }) });
}
export async function disablePush() {
  if (!supportsPush()) return;
  const worker = await navigator.serviceWorker.getRegistration("/");
  const subscription = await worker?.pushManager.getSubscription();
  if (!subscription) return;
  try { await api("/v1/push/subscriptions", { method: "DELETE", body: JSON.stringify({ endpoint: subscription.endpoint }) }); }
  finally { await subscription.unsubscribe(); const notices = await worker?.getNotifications(); notices?.forEach(notice => notice.close()); }
}
