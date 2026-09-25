"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import "./dashboard.css";
import "./live.css";
import "./mobile-fix.css";
import "./overview-enhancements.css";

type Patient = { id: string; full_name: string; phone: string | null; email: string | null; created_at?: string };
type Appointment = { id: string; patient_id: string; starts_at: string; status: string };
type Workspace = { id: string; name: string; role: string; user: string };
type IconName = "home" | "calendar" | "users" | "team" | "wallet" | "chart" | "plus" | "refresh" | "arrow" | "clock" | "spark" | "menu" | "close";

const initials = (value: string) => value.split(" ").map((word) => word[0]).slice(0, 2).join("").toUpperCase() || "M";
const navItems: { label: string; icon: IconName }[] = [
  { label: "Visão geral", icon: "home" }, { label: "Agenda", icon: "calendar" },
  { label: "Pacientes", icon: "users" }, { label: "Colaboradores", icon: "team" },
  { label: "Financeiro", icon: "wallet" }, { label: "Relatórios", icon: "chart" },
];

function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  const common = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
  const paths: Record<IconName, React.ReactNode> = {
    home: <><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1Z" /><path d="M9 21v-6h6v6" /></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /></>,
    users: <><circle cx="12" cy="8" r="4" /><path d="M4.5 21a7.5 7.5 0 0 1 15 0" /></>,
    team: <><circle cx="9" cy="8" r="3" /><path d="M3.5 20a5.5 5.5 0 0 1 11 0" /><path d="M16 5.5a3 3 0 0 1 0 5.8M17.5 14.5a5.5 5.5 0 0 1 3 5.5" /></>,
    wallet: <><path d="M20 7V5a2 2 0 0 0-2-2H5a3 3 0 0 0 0 6h16v10a2 2 0 0 1-2 2H5a3 3 0 0 1-3-3V6" /><path d="M16 14h.01" /></>,
    chart: <><path d="M4 19V5M4 19h16" /><path d="m7 15 4-4 3 2 5-6" /></>,
    plus: <><path d="M12 5v14M5 12h14" /></>, refresh: <><path d="M20 11a8 8 0 1 0 2 5" /><path d="M20 4v7h-7" /></>,
    arrow: <><path d="M5 12h14M13 6l6 6-6 6" /></>, clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    spark: <path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8Z" />,
    menu: <><path d="M4 7h16M4 12h16M4 17h16" /></>,
    close: <><path d="m6 6 12 12M18 6 6 18" /></>,
  };
  return <svg {...common}>{paths[name]}</svg>;
}

export default function Dashboard() {
  const router = useRouter();
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [page, setPage] = useState("Visão geral");
  const [newPatient, setNewPatient] = useState(false);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  async function load() {
    try {
      setError("");
      if (!supabase) throw Error("Supabase não configurado.");
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return router.replace("/auth");
      const { data: membership, error: membershipError } = await supabase.from("clinic_members").select("clinic_id,role").eq("user_id", user.id).limit(1).maybeSingle();
      if (membershipError) throw membershipError;
      if (!membership) return router.replace("/onboarding");
      const { data: clinic, error: clinicError } = await supabase.from("clinics").select("id,name").eq("id", membership.clinic_id).single();
      if (clinicError || !clinic) throw clinicError || Error("Clínica não encontrada.");
      const { data: patientRows, error: patientError } = await supabase.from("patients").select("id,full_name,phone,email,created_at").eq("clinic_id", clinic.id).order("created_at", { ascending: false });
      if (patientError) throw patientError;
      const start = new Date(); start.setHours(0, 0, 0, 0);
      const end = new Date(start); end.setDate(end.getDate() + 1);
      const { data: appointmentRows } = await supabase.from("appointments").select("id,patient_id,starts_at,status").eq("clinic_id", clinic.id).gte("starts_at", start.toISOString()).lt("starts_at", end.toISOString()).order("starts_at");
      setWorkspace({ id: clinic.id, name: clinic.name, role: membership.role, user: user.user_metadata.full_name || user.email || "" });
      setPatients((patientRows || []) as Patient[]);
      setAppointments((appointmentRows || []) as Appointment[]);
    } catch (caught) {
      setError(caught && typeof caught === "object" && "message" in caught ? String(caught.message) : "Erro ao carregar.");
    } finally { setRefreshing(false); }
  }

  useEffect(() => { load(); }, []);
  const refresh = () => { setRefreshing(true); load(); };
  if (!workspace) return <main className="loading-screen"><span className="brand-mark">M</span><p>{error || "Carregando sua clínica..."}</p>{error && <button className="button" onClick={load}>Tentar novamente</button>}</main>;

  return <main className="app-shell">
    <aside className="sidebar">
      <Link href="/" className="brand side-brand"><span className="brand-mark">M</span> medix</Link>
      <div className="clinic-switch"><span className="clinic-avatar">{initials(workspace.name)}</span><div><b>{workspace.name}</b><small>{workspace.role === "owner" ? "Administradora" : workspace.role}</small></div></div>
      <nav className="side-nav">{navItems.map((item) => <button key={item.label} className={page === item.label ? "selected" : ""} onClick={() => setPage(item.label)}><i><Icon name={item.icon} /></i><span>{item.label}</span></button>)}</nav>
      <div className="side-bottom"><div className="help"><span>?</span><div><b>Central de ajuda</b><small>Precisa de suporte?</small></div></div></div>
    </aside>
    <section className="dashboard">
      <header className="topbar"><div className="mobile-brand"><span className="brand-mark">M</span> medix</div><div className="search">⌕ <input placeholder="Buscar pacientes..." /></div><div className="topbar-mobile-actions"><button className="mobile-menu-trigger" aria-label="Abrir menu" onClick={() => setMobileMenuOpen(true)}><Icon name="menu" /></button><button className="profile"><span>{initials(workspace.user)}</span><b>{workspace.user}<small>{workspace.role === "owner" ? "Administradora" : workspace.role}</small></b></button></div></header>
      <div className="content">
        <div className="page-header"><div><p>{new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long" }).format(new Date())}</p><h1>{page === "Visão geral" ? <>Olá, {workspace.user.split(" ")[0]} <span>✦</span></> : page}</h1></div><button className="new-button" onClick={() => setNewPatient(true)}><Icon name="plus" size={16} /> Novo paciente</button></div>
        {page === "Visão geral" ? <Overview patients={patients} appointments={appointments} openPatient={() => setNewPatient(true)} goPatients={() => setPage("Pacientes")} refresh={refresh} refreshing={refreshing} /> : page === "Pacientes" ? <PatientList patients={patients} /> : <section className="panel coming"><span>✦</span><h2>{page}</h2><p>Este módulo será retomado depois.</p></section>}
      </div>
    </section>
    <div className={"mobile-menu-layer " + (mobileMenuOpen ? "is-open" : "")} aria-hidden={!mobileMenuOpen}>
      <button className="mobile-menu-backdrop" aria-label="Fechar menu" onClick={() => setMobileMenuOpen(false)} />
      <section className="mobile-menu-drawer">
        <div className="mobile-menu-head"><div className="brand"><span className="brand-mark">M</span> medix</div><button aria-label="Fechar menu" onClick={() => setMobileMenuOpen(false)}><Icon name="close" /></button></div>
        <div className="mobile-clinic"><span className="clinic-avatar">{initials(workspace.name)}</span><div><b>{workspace.name}</b><small>{workspace.role === "owner" ? "Administradora" : workspace.role}</small></div></div>
        <nav>{navItems.map((item) => <button key={item.label} className={page === item.label ? "selected" : ""} onClick={() => { setPage(item.label); setMobileMenuOpen(false); }}><Icon name={item.icon} /><span>{item.label}</span></button>)}</nav>
        <div className="mobile-menu-help"><span>?</span><div><b>Central de ajuda</b><small>Precisa de suporte?</small></div></div>
      </section>
    </div>
    {newPatient && <PatientForm clinic={workspace.id} close={() => setNewPatient(false)} done={() => { setNewPatient(false); load(); }} />}
  </main>;
}

function Overview({ patients, appointments, openPatient, goPatients, refresh, refreshing }: { patients: Patient[]; appointments: Appointment[]; openPatient: () => void; goPatients: () => void; refresh: () => void; refreshing: boolean }) {
  const confirmed = appointments.filter((appointment) => appointment.status === "confirmed").length;
  const appointmentNote = appointments.length ? confirmed + " confirmada" + (confirmed === 1 ? "" : "s") : "Agenda disponível";
  const appointmentText = appointments.length ? appointments.length + " atendimento" + (appointments.length === 1 ? "" : "s") + " programado" + (appointments.length === 1 ? "" : "s") : "Organize os próximos atendimentos.";
  return <>
    <section className="metrics metrics-updated">
      <Metric icon="calendar" tone="purple" label="Consultas hoje" value={String(appointments.length)} note={appointmentNote} />
      <Metric icon="users" tone="orange" label="Pacientes ativos" value={String(patients.length)} note={patients.length ? "Base da sua clínica" : "Comece cadastrando"} />
      <Metric icon="clock" tone="green" label="Próximo atendimento" value={appointments[0] ? new Date(appointments[0].starts_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "Livre"} note={appointments[0] ? "Hoje" : "Sem consultas"} />
      <Metric icon="chart" tone="blue" label="Resumo financeiro" value="—" note="Em breve" />
    </section>
    <section className="quick-actions"><div><p className="section-kicker">AÇÕES RÁPIDAS</p><h2>O que você precisa fazer hoje?</h2></div><div className="quick-action-buttons"><button onClick={openPatient}><span className="quick-icon purple"><Icon name="plus" /></span><span><b>Novo paciente</b><small>Crie um cadastro</small></span><Icon name="arrow" size={16} /></button><button onClick={goPatients}><span className="quick-icon blue"><Icon name="users" /></span><span><b>Ver pacientes</b><small>Acesse os cadastros</small></span><Icon name="arrow" size={16} /></button><button onClick={refresh}><span className="quick-icon green"><Icon name="refresh" /></span><span><b>{refreshing ? "Atualizando..." : "Atualizar painel"}</b><small>Consulte novos dados</small></span><Icon name="arrow" size={16} /></button></div></section>
    <div className="dash-grid dash-grid-updated"><section className="panel"><header><div><p className="section-kicker">AGENDA</p><h2>Consultas de hoje</h2><p>{appointmentText}</p></div><button className="text-action">Ver agenda <Icon name="arrow" size={14} /></button></header><TodayAppointments appointments={appointments} patients={patients} /></section><section className="panel insights-panel"><header><div><p className="section-kicker">PANORAMA</p><h2>Sua clínica em foco</h2><p>Acompanhe os próximos passos.</p></div></header><div className="insight-list"><div><span className="insight-icon"><Icon name="spark" size={16} /></span><p><b>{patients.length ? "Cadastros atualizados" : "Comece por aqui"}</b><small>{patients.length ? "Use os dados para manter a agenda organizada." : "Cadastre seu primeiro paciente para iniciar."}</small></p></div><div><span className="insight-icon neutral"><Icon name="calendar" size={16} /></span><p><b>{appointments.length ? "Agenda em andamento" : "Dia livre"}</b><small>{appointments.length ? "Confira seus horários antes do próximo atendimento." : "Inclua uma consulta quando estiver pronto."}</small></p></div></div></section></div>
    <section className="panel patients-panel"><header><div><p className="section-kicker">PACIENTES</p><h2>Cadastros recentes</h2><p>Últimos pacientes adicionados à clínica</p></div><button onClick={goPatients} className="text-action">Ver todos <Icon name="arrow" size={14} /></button></header><PatientRows patients={patients.slice(0, 4)} /></section>
  </>;
}

function Metric({ icon, tone, label, value, note }: { icon: IconName; tone: string; label: string; value: string; note: string }) { return <article className="metric"><span className={"metric-icon " + tone}><Icon name={icon} /></span><div><p>{label}</p><h2>{value}</h2><em>{note}</em></div></article>; }
function TodayAppointments({ appointments, patients }: { appointments: Appointment[]; patients: Patient[] }) { if (!appointments.length) return <div className="empty-state compact"><b><Icon name="calendar" size={17} /></b><p>Nenhuma consulta para hoje.</p><small>Use a Agenda para organizar seu dia.</small></div>; return <div className="timeline">{appointments.map((appointment) => { const patient = patients.find((item) => item.id === appointment.patient_id); return <div className="appointment" key={appointment.id}><time>{new Date(appointment.starts_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</time><span className="avatar purple-av">{initials(patient?.full_name || "P")}</span><b>{patient?.full_name || "Paciente"}<small>{appointment.status === "confirmed" ? "Confirmada" : "Agendada"}</small></b><span className={"status " + appointment.status}>{appointment.status === "confirmed" ? "Confirmada" : "Agendada"}</span></div>; })}</div>; }
function PatientList({ patients }: { patients: Patient[] }) { return <section className="panel table-panel"><header><div><h2>Cadastro de pacientes</h2><p>{patients.length} paciente(s) cadastrados</p></div></header><PatientRows patients={patients} /></section>; }
function PatientRows({ patients }: { patients: Patient[] }) { return patients.length ? <div className="patient-rows">{patients.map((patient) => <div className="patient-row" key={patient.id}><span className="avatar purple-av">{initials(patient.full_name)}</span><b>{patient.full_name}<small>{patient.phone || patient.email || "Sem contato informado"}</small></b><span>Cadastro ativo</span></div>)}</div> : <div className="empty-state"><b>✦</b><p>Nenhum paciente cadastrado.</p><small>Use o botão acima para começar.</small></div>; }
function PatientForm({ clinic, close, done }: { clinic: string; close: () => void; done: () => void }) { const [name, setName] = useState(""); const [phone, setPhone] = useState(""); const [email, setEmail] = useState(""); const [error, setError] = useState(""); async function save(event: FormEvent) { event.preventDefault(); const { error: insertError } = await supabase!.from("patients").insert({ clinic_id: clinic, full_name: name, phone: phone || null, email: email || null }); if (insertError) setError(insertError.message); else done(); } return <div className="modal-backdrop"><form className="modal patient-form" onSubmit={save}><button type="button" className="close" onClick={close}>×</button><span className="modal-icon"><Icon name="users" /></span><h2>Novo paciente</h2><label>Nome completo<input required value={name} onChange={(event) => setName(event.target.value)} /></label><label>Telefone<input value={phone} onChange={(event) => setPhone(event.target.value)} /></label><label>E-mail<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label>{error && <div className="auth-feedback">{error}</div>}<button className="button">Salvar paciente <span>→</span></button></form></div>; }
