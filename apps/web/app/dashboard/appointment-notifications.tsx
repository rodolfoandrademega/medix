"use client";
import { useEffect, useState } from "react";
import { api, ApiError } from "../../lib/api";
import { supabase } from "../../lib/supabase";
import { enablePush, disablePush, syncPush } from "../../lib/push";
import "./appointment-notifications.css";

type Notice = { id: string; kind: string; starts_at: string; ends_at: string; occurred_at: string; patient: string; procedure: string };
type Preferences = { enabled: boolean; pushEnabled?: boolean; advance: number; read: string[]; delivered: string[] };
const defaults: Preferences = { enabled: false, pushEnabled: false, advance: 30, read: [], delivered: [] };
const dateTime = (value: string) => new Date(value).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

export function AppointmentNotifications({ clinic }: { clinic: string }) {
  const [open, setOpen] = useState(false), [preferences, setPreferences] = useState<Preferences>(defaults);
  const [key, setKey] = useState(""), [notices, setNotices] = useState<Notice[]>([]), [message, setMessage] = useState(""), [error, setError] = useState(""), [loading, setLoading] = useState(true);
  const [pushConfig, setPushConfig] = useState<{ enabled: boolean; publicKey: string | null } | null>(null), [activating, setActivating] = useState(false);
  useEffect(() => { let cancelled = false; setPushConfig(null); void api<{ enabled: boolean; publicKey: string | null }>("/v1/push/config").then(result => { if (!cancelled) setPushConfig(result); }).catch(() => { if (!cancelled) setPushConfig({ enabled: false, publicKey: null }); }); return () => { cancelled = true; }; }, [clinic]);
  useEffect(() => {
    let cancelled = false;
    setKey(""); setNotices([]); setPreferences(defaults); setMessage(""); setError(""); setLoading(true);
    void (async () => {
      const session = await supabase?.auth.getSession();
      if (cancelled || !session?.data.session) return;
      const storageKey = `medix-notifications:${session.data.session.user.id}:${clinic}`;
      let saved = defaults;
      try { const raw = JSON.parse(localStorage.getItem(storageKey) || "null"); if (raw) saved = { enabled: raw.enabled === true, pushEnabled: raw.pushEnabled === true, advance: [5,15,30,60].includes(raw.advance) ? raw.advance : 30, read: Array.isArray(raw.read) ? raw.read.filter((id: unknown) => typeof id === "string").slice(-500) : [], delivered: Array.isArray(raw.delivered) ? raw.delivered.filter((id: unknown) => typeof id === "string").slice(-500) : [] }; } catch { /* Preferências inválidas: usa o padrão seguro. */ }
      setPreferences(saved); setKey(storageKey);
    })();
    return () => { cancelled = true; };
  }, [clinic]);
  useEffect(() => { if (key) { try { localStorage.setItem(key, JSON.stringify(preferences)); } catch { /* A central funciona sem armazenamento. */ } } }, [key, preferences]);
  useEffect(() => { if (key && preferences.pushEnabled && pushConfig?.enabled) void syncPush(preferences.advance).catch(() => setMessage("Não foi possível sincronizar o push. Desative e ative novamente neste dispositivo.")); }, [key, preferences.pushEnabled, preferences.advance, pushConfig?.enabled]);
  useEffect(() => {
    if (!key) return;
    let cancelled = false, fetching = false;
    async function check() {
      if (fetching) return; fetching = true;
      try {
        const result = await api<{ notifications: Notice[] }>(`/v1/appointment-notifications?advance=${preferences.advance}`);
        if (!cancelled) { setNotices(result.notifications); setError(""); }
      } catch (caught) {
        if (!cancelled) { setNotices([]); setError(caught instanceof ApiError && caught.status === 403 ? "Os avisos de agendamento exigem acesso à agenda." : "Não foi possível atualizar os avisos. Tentaremos novamente."); }
      } finally { fetching = false; if (!cancelled) setLoading(false); }
    }
    void check(); const timer = window.setInterval(check, 20000);
    const onFocus = () => { void check(); };
    window.addEventListener("focus", onFocus); window.addEventListener("medix-appointment-changed", onFocus);
    return () => { cancelled = true; clearInterval(timer); window.removeEventListener("focus", onFocus); window.removeEventListener("medix-appointment-changed", onFocus); };
  }, [key, preferences.advance]);
  useEffect(() => {
    if (!key || !preferences.enabled || preferences.pushEnabled || typeof Notification === "undefined" || Notification.permission !== "granted") return;
    const sent: string[] = [];
    for (const notice of notices) {
      if (preferences.delivered.includes(notice.id) || preferences.read.includes(notice.id)) continue;
      if (notice.kind === "created" && Date.parse(notice.occurred_at) < Date.now() - 120000) continue;
      try {
        new Notification(notice.kind === "upcoming" ? "Seu agendamento está próximo" : "Novo agendamento na Medix", { body: `Atendimento em ${dateTime(notice.starts_at)}. Abra a Medix para consultar os detalhes.`, icon: "/icon", tag: notice.id });
        sent.push(notice.id);
      } catch { setMessage("Use a central de avisos neste dispositivo. O navegador não permite alertas do sistema."); }
    }
    if (sent.length) setPreferences(current => ({ ...current, delivered: [...new Set([...current.delivered, ...sent])].slice(-500) }));
  }, [notices, key, preferences]);
  async function activate() {
    if (pushConfig?.enabled && pushConfig.publicKey) {
      setActivating(true);
      try { await enablePush(pushConfig.publicKey, preferences.advance); setPreferences(current => ({ ...current, enabled: true, pushEnabled: true })); setMessage("Push ativado: você poderá receber avisos mesmo com a Medix fechada."); }
      catch (caught) { setMessage(caught instanceof Error ? caught.message : "Não foi possível ativar o push."); }
      finally { setActivating(false); }
      return;
    }
    if (typeof Notification === "undefined") return setMessage("Seu navegador não oferece alertas do sistema. Os avisos continuam disponíveis no sino.");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") return setMessage("Permissão não concedida. Você ainda pode acompanhar os avisos no sino.");
      setPreferences(current => ({ ...current, enabled: true })); setMessage("Alertas ativados neste dispositivo enquanto o painel estiver aberto.");
    } catch { setMessage("Não foi possível ativar. Use a central de avisos no sino."); }
  }
  const unread = notices.filter(notice => !preferences.read.includes(notice.id)).length;
  return <div className="notification-control"><button className="notification-bell" aria-label={`Notificações${unread ? `, ${unread} não lidas` : ""}`} aria-expanded={open} onClick={() => setOpen(current => !current)}>🔔{unread > 0 && <span className="notification-count">{unread > 99 ? "99+" : unread}</span>}</button>
    {open && <section className="notification-popover" aria-label="Central de notificações"><div className="notification-heading"><b>Seus avisos de agenda</b><button type="button" aria-label="Fechar notificações" onClick={() => setOpen(false)}>×</button></div><p>Novos agendamentos e lembretes direcionados a você.</p>
      <label>Avisar antes do horário<select value={preferences.advance} onChange={event => setPreferences(current => ({ ...current, advance: Number(event.target.value) }))}><option value={5}>5 minutos</option><option value={15}>15 minutos</option><option value={30}>30 minutos</option><option value={60}>1 hora</option></select></label>
      {error ? <p role="alert">{error}</p> : loading ? <p>Buscando avisos…</p> : <><div className="notification-list">{notices.length ? notices.map(notice => <article key={notice.id} className={preferences.read.includes(notice.id) ? "read" : "unread"}><strong>{notice.kind === "upcoming" ? "O horário está chegando" : "Novo agendamento"}</strong><b>{notice.patient}</b><span>{dateTime(notice.starts_at)} · {notice.procedure}</span><small>Até {new Date(notice.ends_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</small>{!preferences.read.includes(notice.id) && <button type="button" onClick={() => setPreferences(current => ({ ...current, read: [...current.read, notice.id].slice(-500) }))}>Marcar como lido</button>}</article>) : <p>Nenhum aviso por enquanto. Você recebe avisos dos agendamentos em que foi selecionado.</p>}</div>{unread > 0 && <button className="notification-disable" onClick={() => setPreferences(current => ({ ...current, read: [...new Set([...current.read, ...notices.map(notice => notice.id)])].slice(-500) }))}>Marcar todos como lidos</button>}</>}
      {preferences.enabled ? <><button className="notification-disable" disabled={activating} onClick={async () => { setActivating(true); try { await disablePush(); } catch { setMessage("Inscrição local removida. O servidor tentará remover a inscrição expirada."); } finally { setPreferences(current => ({ ...current, enabled: false, pushEnabled: false })); setActivating(false); } }}>Desativar alertas neste dispositivo</button>{!preferences.pushEnabled && pushConfig?.enabled && <button className="button" disabled={activating} onClick={activate}>Ativar também com o app fechado</button>}</> : <button className="button" disabled={!key || activating || pushConfig === null} onClick={activate}>{activating ? "Ativando…" : pushConfig?.enabled ? "Ativar notificações push" : "Ativar alertas do navegador"}</button>}
      <small>{preferences.pushEnabled ? "Push ativo neste dispositivo. A entrega depende da conexão e das permissões do sistema." : pushConfig?.enabled ? "Ative o push para receber com o app fechado. No iPhone/iPad, abra a Medix instalada na Tela de Início." : "Push ainda não configurado no servidor. Por enquanto, os alertas exigem o painel aberto."} Sem envio por WhatsApp ou e-mail. Os alertas não mostram o nome do paciente.</small>{message && <small role="status">{message}</small>}
    </section>}
  </div>;
}
