"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import "./dashboard.css";
import "./live.css";
import "./mobile-fix.css";
import "./overview-enhancements.css";

type Patient = { id: string; full_name: string; phone: string | null; email: string | null; created_at?: string; preferred_name?: string | null; birth_date?: string | null };
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
  const [newAppointment, setNewAppointment] = useState(false);
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
      const { data: patientRows, error: patientError } = await supabase.from("patients").select("id,full_name,phone,email,preferred_name,birth_date,created_at").eq("clinic_id", clinic.id).order("created_at", { ascending: false });
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
        <div className="page-header"><div><p>{new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long" }).format(new Date())}</p><h1>{page === "Visão geral" ? <>Olá, {workspace.user.split(" ")[0]} <span>✦</span></> : page}</h1></div><div className="header-actions"><button className="new-button secondary" onClick={() => setNewPatient(true)}><Icon name="plus" size={16} /> Novo paciente</button><button className="new-button" onClick={() => setNewAppointment(true)}><Icon name="calendar" size={16} /> Novo agendamento</button></div></div>
        {page === "Visão geral" ? <Overview patients={patients} appointments={appointments} openPatient={() => setNewPatient(true)} openAppointment={() => setNewAppointment(true)} goPatients={() => setPage("Pacientes")} refresh={refresh} refreshing={refreshing} /> : page === "Pacientes" ? <PatientList patients={patients} /> : <section className="panel coming"><span>✦</span><h2>{page}</h2><p>Este módulo será retomado depois.</p></section>}
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
    {newAppointment && <AppointmentForm clinic={workspace.id} patients={patients} close={() => setNewAppointment(false)} done={() => { setNewAppointment(false); load(); }} />}
  </main>;
}

function Overview({ patients, appointments, openPatient, openAppointment, goPatients, refresh, refreshing }: { patients: Patient[]; appointments: Appointment[]; openPatient: () => void; openAppointment: () => void; goPatients: () => void; refresh: () => void; refreshing: boolean }) {
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
    <section className="quick-actions"><div><p className="section-kicker">AÇÕES RÁPIDAS</p><h2>O que você precisa fazer hoje?</h2></div><div className="quick-action-buttons"><button onClick={openAppointment}><span className="quick-icon purple"><Icon name="calendar" /></span><span><b>Novo agendamento</b><small>Reserve um horário</small></span><Icon name="arrow" size={16} /></button><button onClick={openPatient}><span className="quick-icon blue"><Icon name="plus" /></span><span><b>Novo paciente</b><small>Crie um cadastro</small></span><Icon name="arrow" size={16} /></button><button onClick={goPatients}><span className="quick-icon orange"><Icon name="users" /></span><span><b>Ver pacientes</b><small>Acesse os cadastros</small></span><Icon name="arrow" size={16} /></button><button onClick={refresh}><span className="quick-icon green"><Icon name="refresh" /></span><span><b>{refreshing ? "Atualizando..." : "Atualizar painel"}</b><small>Consulte novos dados</small></span><Icon name="arrow" size={16} /></button></div></section>
    <div className="dash-grid dash-grid-updated"><section className="panel"><header><div><p className="section-kicker">AGENDA</p><h2>Consultas de hoje</h2><p>{appointmentText}</p></div><button className="text-action">Ver agenda <Icon name="arrow" size={14} /></button></header><TodayAppointments appointments={appointments} patients={patients} /></section><section className="panel insights-panel"><header><div><p className="section-kicker">PANORAMA</p><h2>Sua clínica em foco</h2><p>Acompanhe os próximos passos.</p></div></header><div className="insight-list"><div><span className="insight-icon"><Icon name="spark" size={16} /></span><p><b>{patients.length ? "Cadastros atualizados" : "Comece por aqui"}</b><small>{patients.length ? "Use os dados para manter a agenda organizada." : "Cadastre seu primeiro paciente para iniciar."}</small></p></div><div><span className="insight-icon neutral"><Icon name="calendar" size={16} /></span><p><b>{appointments.length ? "Agenda em andamento" : "Dia livre"}</b><small>{appointments.length ? "Confira seus horários antes do próximo atendimento." : "Inclua uma consulta quando estiver pronto."}</small></p></div></div></section></div>
    <section className="panel patients-panel"><header><div><p className="section-kicker">PACIENTES</p><h2>Cadastros recentes</h2><p>Últimos pacientes adicionados à clínica</p></div><button onClick={goPatients} className="text-action">Ver todos <Icon name="arrow" size={14} /></button></header><PatientRows patients={patients.slice(0, 4)} /></section>
  </>;
}

function Metric({ icon, tone, label, value, note }: { icon: IconName; tone: string; label: string; value: string; note: string }) { return <article className="metric"><span className={"metric-icon " + tone}><Icon name={icon} /></span><div><p>{label}</p><h2>{value}</h2><em>{note}</em></div></article>; }
function TodayAppointments({ appointments, patients }: { appointments: Appointment[]; patients: Patient[] }) { if (!appointments.length) return <div className="empty-state compact"><b><Icon name="calendar" size={17} /></b><p>Nenhuma consulta para hoje.</p><small>Use a Agenda para organizar seu dia.</small></div>; return <div className="timeline">{appointments.map((appointment) => { const patient = patients.find((item) => item.id === appointment.patient_id); return <div className="appointment" key={appointment.id}><time>{new Date(appointment.starts_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</time><span className="avatar purple-av">{initials(patient?.full_name || "P")}</span><b>{patient?.full_name || "Paciente"}<small>{appointment.status === "confirmed" ? "Confirmada" : "Agendada"}</small></b><span className={"status " + appointment.status}>{appointment.status === "confirmed" ? "Confirmada" : "Agendada"}</span></div>; })}</div>; }
function PatientList({ patients }: { patients: Patient[] }) { return <section className="panel table-panel"><header><div><h2>Cadastro de pacientes</h2><p>{patients.length} paciente(s) cadastrados</p></div></header><PatientRows patients={patients} /></section>; }
function PatientRows({ patients }: { patients: Patient[] }) { return patients.length ? <div className="patient-rows">{patients.map((patient) => <div className="patient-row" key={patient.id}><span className="avatar purple-av">{initials(patient.full_name)}</span><b>{patient.full_name}<small>{patient.phone || patient.email || "Sem contato informado"}</small></b><span>Cadastro ativo</span></div>)}</div> : <div className="empty-state"><b>✦</b><p>Nenhum paciente cadastrado.</p><small>Use o botão acima para começar.</small></div>; }
function PatientForm({ clinic, close, done }: { clinic: string; close: () => void; done: () => void }) {
  const [form, setForm] = useState({
    full_name: "", phone: "", email: "", preferred_name: "", birth_date: "", cpf: "",
    gender: "", occupation: "", postal_code: "", address: "", address_number: "",
    address_complement: "", neighborhood: "", city: "", state: "",
    emergency_contact_name: "", emergency_contact_phone: "", referred_by: "", notes: "",
  });
  const [error, setError] = useState("");
  const update = (field: keyof typeof form, value: string) => setForm((current) => ({ ...current, [field]: value }));

  async function save(event: FormEvent) {
    event.preventDefault();
    setError("");
    const payload = Object.fromEntries(Object.entries(form).map(([key, value]) => [key, value.trim() || null]));
    const { error: insertError } = await supabase!.from("patients").insert({ clinic_id: clinic, ...payload });
    if (insertError) setError(insertError.message); else done();
  }

  return <div className="modal-backdrop">
    <form className="modal patient-form patient-registration" onSubmit={save}>
      <button type="button" className="close" onClick={close}>×</button>
      <span className="modal-icon"><Icon name="users" /></span>
      <h2>Novo paciente</h2>
      <p className="form-intro">Preencha os dados de contato para criar um cadastro organizado.</p>
      <section className="form-section">
        <div className="form-section-title"><b>Dados essenciais</b><small>Obrigatórios</small></div>
        <div className="form-grid">
          <label className="full">Nome completo <strong>*</strong><input required value={form.full_name} onChange={(event) => update("full_name", event.target.value)} placeholder="Nome e sobrenome" /></label>
          <label>Telefone <strong>*</strong><input required type="tel" minLength={8} value={form.phone} onChange={(event) => update("phone", event.target.value)} placeholder="(00) 00000-0000" /></label>
          <label>E-mail <strong>*</strong><input required type="email" value={form.email} onChange={(event) => update("email", event.target.value)} placeholder="email@exemplo.com" /></label>
        </div>
      </section>
      <details className="additional-details">
        <summary><span>Informações adicionais</span><small>Opcional · ajuda a completar o cadastro</small></summary>
        <div className="form-section additional-fields">
          <div className="form-grid">
            <label>Nome social<input value={form.preferred_name} onChange={(event) => update("preferred_name", event.target.value)} /></label>
            <label>Data de nascimento<input type="date" value={form.birth_date} onChange={(event) => update("birth_date", event.target.value)} /></label>
            <label>CPF<input inputMode="numeric" value={form.cpf} onChange={(event) => update("cpf", event.target.value)} /></label>
            <label>Gênero<select value={form.gender} onChange={(event) => update("gender", event.target.value)}><option value="">Não informado</option><option>Feminino</option><option>Masculino</option><option>Não binário</option><option>Prefiro não informar</option></select></label>
            <label className="full">Profissão / ocupação<input value={form.occupation} onChange={(event) => update("occupation", event.target.value)} /></label>
          </div>
          <div className="form-subtitle">Endereço</div>
          <div className="form-grid">
            <label>CEP<input inputMode="numeric" value={form.postal_code} onChange={(event) => update("postal_code", event.target.value)} /></label>
            <label className="full">Endereço<input value={form.address} onChange={(event) => update("address", event.target.value)} /></label>
            <label>Número<input value={form.address_number} onChange={(event) => update("address_number", event.target.value)} /></label>
            <label>Complemento<input value={form.address_complement} onChange={(event) => update("address_complement", event.target.value)} /></label>
            <label>Bairro<input value={form.neighborhood} onChange={(event) => update("neighborhood", event.target.value)} /></label>
            <label>Cidade<input value={form.city} onChange={(event) => update("city", event.target.value)} /></label>
            <label>UF<input maxLength={2} value={form.state} onChange={(event) => update("state", event.target.value.toUpperCase())} /></label>
          </div>
          <div className="form-subtitle">Contato de emergência</div>
          <div className="form-grid">
            <label>Nome<input value={form.emergency_contact_name} onChange={(event) => update("emergency_contact_name", event.target.value)} /></label>
            <label>Telefone<input type="tel" value={form.emergency_contact_phone} onChange={(event) => update("emergency_contact_phone", event.target.value)} /></label>
            <label className="full">Como conheceu a clínica?<input value={form.referred_by} onChange={(event) => update("referred_by", event.target.value)} placeholder="Indicação, Instagram, Google..." /></label>
            <label className="full">Observações<input value={form.notes} onChange={(event) => update("notes", event.target.value)} placeholder="Informações administrativas relevantes" /></label>
          </div>
        </div>
      </details>
      {error && <div className="auth-feedback">{error}</div>}
      <button className="button">Salvar paciente <span>→</span></button>
    </form>
  </div>;
}

function AppointmentForm({ clinic, patients, close, done }: { clinic: string; patients: Patient[]; close: () => void; done: () => void }) {
  const initialDate = new Date();
  initialDate.setMinutes(Math.ceil(initialDate.getMinutes() / 30) * 30, 0, 0);
  const [patientId, setPatientId] = useState("");
  const [startsAt, setStartsAt] = useState(initialDate.toISOString().slice(0, 16));
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!patientId) return setError("Selecione um paciente para continuar.");
    setSaving(true);
    setError("");
    const start = new Date(startsAt);
    const end = new Date(start.getTime() + 30 * 60 * 1000);
    const { error: insertError } = await supabase!.from("appointments").insert({
      clinic_id: clinic, patient_id: patientId, starts_at: start.toISOString(), ends_at: end.toISOString(),
      status: "scheduled", notes: notes.trim() || null, duration_minutes: 30,
    });
    setSaving(false);
    if (insertError) setError(insertError.message); else done();
  }

  return <div className="modal-backdrop">
    <form className="modal appointment-form" onSubmit={save}>
      <button type="button" className="close" onClick={close}>×</button>
      <span className="modal-icon"><Icon name="calendar" /></span>
      <h2>Novo agendamento</h2>
      <p>Reserve um horário de 30 minutos. Você poderá adicionar procedimentos na próxima etapa da agenda.</p>
      {!patients.length ? <div className="auth-feedback">Cadastre um paciente antes de criar um agendamento.</div> : <>
        <label>Paciente <strong>*</strong><select required value={patientId} onChange={(event) => setPatientId(event.target.value)}><option value="">Selecione um paciente</option>{patients.map((patient) => <option key={patient.id} value={patient.id}>{patient.full_name}</option>)}</select></label>
        <label>Data e horário <strong>*</strong><input required type="datetime-local" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} /></label>
        <label>Observações <small>Opcional</small><input value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Ex.: primeira consulta" /></label>
        {error && <div className="auth-feedback">{error}</div>}
        <button disabled={saving} className="button">{saving ? "Salvando..." : "Confirmar agendamento"} <span>→</span></button>
      </>}
    </form>
  </div>;
}
