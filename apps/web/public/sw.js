// Apenas push: não armazena páginas, respostas da API ou dados clínicos em cache.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", event => event.waitUntil(self.clients.claim()));
self.addEventListener("push", event => {
  let payload = {};
  try { payload = event.data?.json() || {}; } catch { /* Exibe aviso seguro. */ }
  event.waitUntil(self.registration.showNotification(payload.title === "Um agendamento está próximo" ? payload.title : "Novo agendamento na Medix", {
    body: "Abra a Medix para consultar os detalhes com segurança.",
    icon: "/icon", badge: "/icon", tag: typeof payload.tag === "string" ? payload.tag : "medix-agenda",
    data: { url: "/dashboard" },
  }));
});
self.addEventListener("notificationclick", event => {
  event.notification.close();
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const client = windows.find(item => new URL(item.url).origin === self.location.origin);
    if (client) { await client.navigate("/dashboard"); await client.focus(); }
    else await self.clients.openWindow("/dashboard");
  })());
});
