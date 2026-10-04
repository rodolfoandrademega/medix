"use client";

import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import "./appointment-notifications.css";

type Reminder = { id: string; starts_at: string; patients: { full_name: string } | null; procedures: { name: string } | null };
const storageKey = "medix-appointment-reminders";

export function AppointmentNotifications({ clinic }: { clinic: string }) {
  const [open, setOpen] = useState(false); const [enabled, setEnabled] = useState(false); const [advance, setAdvance] = useState(30); const [message, setMessage] = useState("");
  useEffect(() => { const saved = window.localStorage.getItem(storageKey); if (saved) { const config = JSON.parse(saved) as { enabled?: boolean; advance?: number }; setEnabled(Boolean(config.enabled)); setAdvance(config.advance || 30); } }, []);
  useEffect(() => { window.localStorage.setItem(storageKey, JSON.stringify({ enabled, advance })); }, [enabled, advance]);
  useEffect(() => { if (!enabled || typeof Notification === "undefined" || Notification.permission !== "granted") return; async function check() { const now = new Date(); const end = new Date(now.getTime() + advance * 60000); try { const result = await api<{ appointments: Reminder[] }>(`/v1/appointments?reminders=true&from=${encodeURIComponent(now.toISOString())}&to=${encodeURIComponent(end.toISOString())}`); result.appointments.forEach((reminder) => { const sentKey = `medix-reminder-${reminder.id}-${reminder.starts_at}`; if (window.sessionStorage.getItem(sentKey)) return; const time = new Date(reminder.starts_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }); new Notification("Agendamento próximo", { body: `${reminder.patients?.full_name || "Paciente"} às ${time}${reminder.procedures?.name ? ` · ${reminder.procedures.name}` : ""}`, icon: "/icon" }); window.sessionStorage.setItem(sentKey, "1"); }); } catch { /* A próxima verificação tentará novamente. */ } } void check(); const timer = window.setInterval(check, 60000); return () => window.clearInterval(timer); }, [clinic, enabled, advance]);
  async function activate() { if (typeof Notification === "undefined") return setMessage("Seu navegador não oferece notificações."); const permission = await Notification.requestPermission(); if (permission !== "granted") return setMessage("Permissão não concedida. Libere as notificações nas configurações do navegador."); setEnabled(true); setMessage("Lembretes ativados."); }
  return <div className="notification-control"><button className={enabled ? "notification-bell enabled" : "notification-bell"} aria-label="Configurar lembretes" onClick={() => setOpen((current) => !current)}>🔔</button>{open && <section className="notification-popover"><b>Lembretes de agenda</b><p>Receba um aviso antes dos seus próximos atendimentos.</p><label>Antecedência<select value={advance} onChange={(event) => setAdvance(Number(event.target.value))}><option value={15}>15 minutos</option><option value={30}>30 minutos</option><option value={60}>1 hora</option></select></label>{enabled ? <button className="notification-disable" onClick={() => { setEnabled(false); setMessage("Lembretes desativados."); }}>Desativar lembretes</button> : <button className="button" onClick={activate}>Ativar notificações</button>}{message && <small>{message}</small>}</section>}</div>;
}
