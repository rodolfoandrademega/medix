"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import "../globals.css";
import "../mobile.css";
import "./admin.css";

type Status = "pending" | "active" | "suspended" | "inactive";
type Modules = Record<"overview" | "agenda" | "patients" | "procedures" | "team" | "financial" | "reports", boolean>;
type Clinic = {
  id: string; name: string; slug: string; status: Status; plan_name: string; created_at: string;
  enabled_modules: Modules; admin_alert_title: string | null; admin_alert_message: string | null; admin_alert_level: "info" | "warning" | "important";
};

const labels: Record<Status, string> = { pending: "Pendente", active: "Ativa", suspended: "Suspensa", inactive: "Inativa" };
const moduleLabels: { key: keyof Modules; label: string }[] = [
  { key: "overview", label: "Visão geral" }, { key: "agenda", label: "Agenda" }, { key: "patients", label: "Pacientes" }, { key: "procedures", label: "Procedimentos" },
  { key: "team", label: "Colaboradores" }, { key: "financial", label: "Financeiro" }, { key: "reports", label: "Relatórios" },
];
const defaults: Modules = { overview: true, agenda: true, patients: true, procedures: true, team: true, financial: true, reports: true };

export default function AdminPage() {
  const router = useRouter();
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [adminName, setAdminName] = useState("");
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState("");
  const [editing, setEditing] = useState<Clinic | null>(null);

  async function load() {
    if (!supabase) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return router.replace("/admin/login");
    const { data: allowed } = await supabase.rpc("is_platform_admin");
    if (!allowed) return router.replace("/admin/login");
    setAdminName(user.user_metadata.full_name || user.email || "Administrador");
    const { data, error } = await supabase.from("clinics")
      .select("id,name,slug,status,plan_name,created_at,enabled_modules,admin_alert_title,admin_alert_message,admin_alert_level")
      .order("created_at", { ascending: false });
    if (error) setMessage(error.message);
    else setClinics((data || []).map((clinic) => ({ ...clinic, enabled_modules: { ...defaults, ...(clinic.enabled_modules || {}) } })) as Clinic[]);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function changeStatus(clinic: Clinic, status: Status) {
    setWorking(true); setMessage("");
    const { error } = await supabase!.from("clinics").update({ status, status_updated_at: new Date().toISOString() }).eq("id", clinic.id);
    setWorking(false);
    if (error) setMessage(error.message); else { setMessage(`${clinic.name} agora está ${labels[status].toLowerCase()}.`); load(); }
  }

  async function removeClinic(clinic: Clinic) {
    if (!window.confirm(`Excluir ${clinic.name}? Esta ação remove permanentemente os dados desta clínica e não pode ser desfeita.`)) return;
    setWorking(true); setMessage("");
    const { error } = await supabase!.from("clinics").delete().eq("id", clinic.id);
    setWorking(false);
    if (error) setMessage(error.message); else { setMessage(`${clinic.name} foi excluída.`); load(); }
  }

  async function exportBackup(clinic: Clinic) {
    setWorking(true); setMessage("");
    const { data, error } = await supabase!.rpc("export_clinic_backup", { target_clinic: clinic.id });
    setWorking(false);
    if (error) return setMessage(error.message);
    const file = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(file); const link = document.createElement("a");
    link.href = url; link.download = `backup-${clinic.slug}-${new Date().toISOString().slice(0, 10)}.json`; link.click(); URL.revokeObjectURL(url);
    setMessage(`Backup de ${clinic.name} baixado.`);
  }

  async function requestRefresh() {
    setWorking(true); setMessage("");
    const now = new Date().toISOString();
    const { error } = await supabase!.from("platform_settings").update({ refresh_requested_at: now, updated_at: now }).eq("singleton", true);
    setWorking(false);
    if (error) setMessage(error.message); else setMessage("Atualização solicitada. As clínicas verão o aviso de recarregamento ao abrir ou atualizar o painel.");
  }

  const count = (status: Status) => clinics.filter((clinic) => clinic.status === status).length;
  return <main className="admin-page">
    <header className="admin-topbar"><Link href="/" className="admin-logo"><span className="brand-mark">M</span><span>medix <small>console</small></span></Link><div><span>Super admin</span><b>{adminName}</b></div></header>
    <section className="admin-content">
      <div className="admin-title"><div><p>ADMINISTRAÇÃO DA PLATAFORMA</p><h1>Clínicas e liberações</h1><span>Controle acessos, avisos e a operação de cada clínica.</span></div><div className="admin-global-actions"><button disabled={working} onClick={requestRefresh}>↻ Solicitar atualização</button></div></div>
      <div className="admin-metrics"><article><span>Pendentes</span><b>{count("pending")}</b></article><article><span>Ativas</span><b>{count("active")}</b></article><article><span>Suspensas</span><b>{count("suspended")}</b></article><article><span>Inativas</span><b>{count("inactive")}</b></article></div>
      {message && <div className="admin-notice">{message}</div>}
      <section className="admin-table"><header><div><h2>Empresas cadastradas</h2><p>Gerencie a liberação e os recursos de cada conta.</p></div><span>{clinics.length} clínica(s)</span></header>
        {loading ? <p className="admin-empty">Carregando clínicas…</p> : !clinics.length ? <p className="admin-empty">Nenhuma clínica cadastrada.</p> : clinics.map((clinic) => <article key={clinic.id}>
          <div className="clinic-cell"><b>{clinic.name}</b><small>Plano {clinic.plan_name} · cadastro em {new Intl.DateTimeFormat("pt-BR").format(new Date(clinic.created_at))}</small></div>
          <span className={`status-badge ${clinic.status}`}>{labels[clinic.status]}</span>
          <div className="admin-actions"><button disabled={working} onClick={() => setEditing(clinic)}>Editar</button><button disabled={working} onClick={() => exportBackup(clinic)}>Backup</button><button disabled={working} onClick={() => changeStatus(clinic, clinic.status === "active" ? "suspended" : "active")}>{clinic.status === "active" ? "Suspender" : "Ativar"}</button><button className="danger" disabled={working} onClick={() => removeClinic(clinic)}>Excluir</button></div>
        </article>)}</section>
    </section>
    {editing && <ClinicEditor clinic={editing} close={() => setEditing(null)} saved={(text) => { setEditing(null); setMessage(text); load(); }} />}
  </main>;
}

function ClinicEditor({ clinic, close, saved }: { clinic: Clinic; close: () => void; saved: (message: string) => void }) {
  const [name, setName] = useState(clinic.name); const [plan, setPlan] = useState(clinic.plan_name);
  const [modules, setModules] = useState<Modules>({ ...defaults, ...clinic.enabled_modules });
  const [alertTitle, setAlertTitle] = useState(clinic.admin_alert_title || ""); const [alertMessage, setAlertMessage] = useState(clinic.admin_alert_message || "");
  const [alertLevel, setAlertLevel] = useState(clinic.admin_alert_level || "info"); const [error, setError] = useState(""); const [saving, setSaving] = useState(false);
  function toggle(key: keyof Modules) { setModules((current) => ({ ...current, [key]: !current[key] })); }
  async function save(event: FormEvent) {
    event.preventDefault(); setSaving(true); setError("");
    const { error: updateError } = await supabase!.from("clinics").update({ name: name.trim(), plan_name: plan.trim() || "Essencial", enabled_modules: modules, admin_alert_title: alertTitle.trim() || null, admin_alert_message: alertMessage.trim() || null, admin_alert_level: alertLevel, status_updated_at: new Date().toISOString() }).eq("id", clinic.id);
    setSaving(false); if (updateError) setError(updateError.message); else saved(`${name.trim()} foi atualizada.`);
  }
  return <div className="admin-modal-layer"><form className="admin-editor" onSubmit={save}><button className="editor-close" type="button" onClick={close}>×</button><p>CONFIGURAÇÃO DA CLÍNICA</p><h2>{clinic.name}</h2><span className="editor-subtitle">Personalize os recursos liberados e a comunicação da conta.</span>
    <div className="editor-grid"><label>Nome da clínica<input required value={name} onChange={(event) => setName(event.target.value)} /></label><label>Plano<input value={plan} onChange={(event) => setPlan(event.target.value)} /></label></div>
    <section className="editor-section"><h3>Recursos liberados</h3><div className="module-grid">{moduleLabels.map(({ key, label }) => <label key={key} className="module-toggle"><input type="checkbox" checked={modules[key]} onChange={() => toggle(key)} /><span>{label}</span></label>)}</div></section>
    <section className="editor-section"><h3>Alerta na visão geral</h3><p>Use para comunicar manutenção, pendências de pagamento, novidades ou orientações. Deixe título e mensagem vazios para remover o aviso.</p><div className="editor-grid"><label>Título<input value={alertTitle} onChange={(event) => setAlertTitle(event.target.value)} placeholder="Ex.: Atualização programada" /></label><label>Prioridade<select value={alertLevel} onChange={(event) => setAlertLevel(event.target.value as "info" | "warning" | "important")}><option value="info">Informativo</option><option value="warning">Atenção</option><option value="important">Importante</option></select></label><label className="wide">Mensagem<textarea value={alertMessage} onChange={(event) => setAlertMessage(event.target.value)} placeholder="Ex.: O sistema passará por manutenção no domingo, das 22h às 23h." /></label></div></section>
    {error && <div className="admin-notice">{error}</div>}<div className="editor-footer"><button type="button" onClick={close}>Cancelar</button><button className="button" disabled={saving}>{saving ? "Salvando…" : "Salvar configurações"}</button></div>
  </form></div>;
}
