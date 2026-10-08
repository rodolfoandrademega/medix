"use client";

import Link from "next/link";
import { type FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "../../lib/api";
import "../globals.css";
import "../mobile.css";
import "./admin.css";
import "./console.css";
import { signOut } from "../../lib/auth";

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
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Status | "all">("all");
  const [page, setPage] = useState(1);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [messageKind, setMessageKind] = useState<"success" | "error">("success");

  function notice(text: string, kind: "success" | "error" = "success") {
    setMessage(text); setMessageKind(kind);
  }


  const load = useCallback(async () => {
    setRefreshing(true); setLoadError("");
    try {
      const result = await api<{ admin: { full_name?: string } | null; clinics: Clinic[] }>("/v1/admin/clinics");
      setAdminName(result.admin?.full_name || "Administrador");
      setClinics((result.clinics || []).map((clinic) => ({ ...clinic, enabled_modules: { ...defaults, ...(clinic.enabled_modules || {}) } })));
    } catch (error) {
      if (error instanceof ApiError && (error.status === 401 || error.status === 403)) router.replace("/admin/login");
      else setLoadError(error instanceof Error ? error.message : "Não foi possível carregar as clínicas.");
    } finally { setLoading(false); setRefreshing(false); }
  }, [router]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { setPage(1); }, [query, filter]);

  async function exit() {
    setWorking(true);
    try { await signOut(); router.replace("/admin/login"); }
    catch { notice("Não foi possível encerrar sua sessão. Tente novamente.", "error"); }
    finally { setWorking(false); }
  }

  async function changeStatus(clinic: Clinic, status: Status) {
    setWorking(true); setMessage("");
    let failure = ""; try { await api(`/v1/admin/clinics/${clinic.id}`, { method: "PATCH", body: JSON.stringify({ status }) }); } catch (error) { failure = error instanceof Error ? error.message : "Erro ao atualizar clínica."; }
    setWorking(false);
    if (failure) notice(failure, "error"); else { notice(`${clinic.name} agora está ${labels[status].toLowerCase()}.`); void load(); }
  }

  async function removeClinic(clinic: Clinic) {
    if (!window.confirm(`Excluir ${clinic.name}? Esta ação remove permanentemente os dados desta clínica e não pode ser desfeita.`)) return;
    setWorking(true); setMessage("");
    let failure = ""; try { await api(`/v1/admin/clinics/${clinic.id}`, { method: "DELETE" }); } catch (error) { failure = error instanceof Error ? error.message : "Erro ao excluir clínica."; }
    setWorking(false);
    if (failure) notice(failure, "error"); else { notice(`${clinic.name} foi excluída.`); void load(); }
  }

  async function exportBackup(clinic: Clinic) {
    setWorking(true); setMessage("");
    let data: unknown; try { data = await api(`/v1/admin/clinics/${clinic.id}/backup`); } catch (error) { setWorking(false); return notice(error instanceof Error ? error.message : "Erro ao gerar backup.", "error"); }
    setWorking(false);
    const file = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(file); const link = document.createElement("a");
    link.href = url; link.download = `backup-${clinic.slug}-${new Date().toISOString().slice(0, 10)}.json`; link.click(); URL.revokeObjectURL(url);
    notice(`Backup de ${clinic.name} baixado.`);
  }

  async function requestRefresh() {
    setWorking(true); setMessage("");
    let failure = ""; try { await api("/v1/admin/refresh", { method: "POST" }); } catch (error) { failure = error instanceof Error ? error.message : "Erro ao solicitar atualização."; }
    setWorking(false);
    if (failure) notice(failure, "error"); else notice("Aviso enviado. As clínicas verão a solicitação de recarregamento ao abrir ou atualizar o painel.");
  }

  const count = (status: Status) => clinics.filter((clinic) => clinic.status === status).length;
  const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const filtered = clinics.filter((clinic) => (filter === "all" || clinic.status === filter) && normalize(`${clinic.name} ${clinic.slug} ${clinic.plan_name}`).includes(normalize(query.trim())));
  const totalPages = Math.max(1, Math.ceil(filtered.length / 8));
  const currentPage = Math.min(page, totalPages);
  const visible = filtered.slice((currentPage - 1) * 8, currentPage * 8);
  const initials = (name: string) => name.split(" ").filter(Boolean).slice(0, 2).map((word) => word[0]).join("").toUpperCase();

  return <main className="admin-page admin-console">
    <header className="admin-topbar"><Link href="/" className="admin-logo"><span className="brand-mark">m<span>+</span></span><span>medix<small>CONSOLE DA PLATAFORMA</small></span></Link><div className="console-account"><span className="console-account-avatar" aria-hidden="true">{initials(adminName || "Admin")}</span><div><span>SUPER ADMIN</span><b>{adminName || "Carregando…"}</b></div><button type="button" disabled={working} onClick={exit}>Sair <span aria-hidden="true">↗</span></button></div></header>
    <section className="admin-content">
      <div className="admin-title"><div><p>VISÃO DA PLATAFORMA</p><h1>Uma gestão mais conectada.</h1><span>Acompanhe suas clínicas, organize os acessos e mantenha a operação em dia.</span></div><div className="admin-global-actions"><button className="console-reload" disabled={refreshing || working} onClick={() => void load()}>{refreshing ? "Atualizando…" : "↻ Atualizar lista"}</button><button disabled={working || loading || !!loadError} onClick={requestRefresh}>Notificar atualização <span aria-hidden="true">↗</span></button></div></div>
      <div className="console-summary"><div><span className="console-summary-label">CLÍNICAS NA MEDIX</span><strong>{loading ? "—" : clinics.length}<span>uma plataforma, diferentes jornadas.</span></strong></div><p>{count("pending") > 0 ? `${count("pending")} clínica(s) aguardando liberação. Confira os cadastros pendentes para dar continuidade ao acesso.` : "Tudo à vista para o próximo passo. Use os filtros para encontrar uma clínica e ajustar seus recursos."}</p><span className="console-summary-decoration" aria-hidden="true">+</span></div>
      <div className="admin-metrics" aria-label="Filtrar clínicas por situação">{(["active", "pending", "suspended", "inactive"] as Status[]).map((status) => <button type="button" key={status} className={`console-metric ${status} ${filter === status ? "selected" : ""}`} aria-pressed={filter === status} onClick={() => setFilter(filter === status ? "all" : status)}><span className="console-metric-heading"><i />{status === "active" ? "Clínicas ativas" : status === "pending" ? "Aguardando liberação" : status === "suspended" ? "Acessos suspensos" : "Clínicas inativas"}<span aria-hidden="true">↗</span></span><strong>{loading ? "—" : count(status)}</strong><small>{status === "active" ? "Com acesso à plataforma" : status === "pending" ? "Cadastros para revisar" : status === "suspended" ? "Atendimento de pendências" : "Fora da operação atual"}</small></button>)}</div>
      {message && <div className={`admin-notice console-notice ${messageKind}`} role={messageKind === "error" ? "alert" : "status"}><span>{message}</span><button type="button" aria-label="Fechar mensagem" onClick={() => setMessage("")}>×</button></div>}
      {loadError && <div className="console-load-error" role="alert"><div><strong>Não foi possível atualizar as clínicas.</strong><p>{loadError}</p></div><button disabled={refreshing} onClick={() => void load()}>Tentar novamente</button></div>}
      <section className="admin-table" aria-labelledby="console-clinics-title"><header><div><p className="console-section-kicker">GESTÃO DE CONTAS</p><h2 id="console-clinics-title">Suas clínicas</h2><p>Cadastros, planos e recursos em um só lugar.</p></div><span className="console-total">{clinics.length} cadastradas</span></header>
        <div className="console-toolbar"><label className="console-search"><span aria-hidden="true">⌕</span><span className="console-sr-only">Buscar clínica, endereço ou plano</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar clínica, endereço ou plano…" /></label><div className="console-filters" role="group" aria-label="Situação das clínicas">{(["all", "active", "pending", "suspended", "inactive"] as const).map((status) => <button type="button" key={status} aria-pressed={filter === status} className={filter === status ? "selected" : ""} onClick={() => setFilter(status)}>{status === "all" ? "Todas" : labels[status]}<span>{status === "all" ? clinics.length : count(status)}</span></button>)}</div></div>
        <div className="console-columns" aria-hidden="true"><span>CLÍNICA</span><span>SITUAÇÃO</span><span>PLANO E RECURSOS</span><span>AÇÕES</span></div>
        {loading ? <p className="admin-empty" role="status">Carregando suas clínicas…</p> : !visible.length ? <div className="console-empty"><span aria-hidden="true">⌕</span><h3>{loadError ? "Os dados estão indisponíveis." : clinics.length ? "Nenhuma clínica encontrada." : "Sua primeira clínica aparecerá aqui."}</h3><p>{loadError ? "Tente carregar a lista novamente." : clinics.length ? "Ajuste a busca ou selecione outra situação." : "Os novos cadastros serão exibidos para você acompanhar a liberação."}</p>{!!clinics.length && <button onClick={() => { setQuery(""); setFilter("all"); }}>Limpar filtros</button>}</div> : visible.map((clinic) => <article key={clinic.id} aria-label={clinic.name}>
          <div className="clinic-cell"><span className="console-clinic-avatar" aria-hidden="true">{initials(clinic.name)}</span><div><b>{clinic.name}</b><small>/{clinic.slug}</small><span className="console-clinic-date">Desde {new Intl.DateTimeFormat("pt-BR").format(new Date(clinic.created_at))}</span></div></div>
          <span className={`status-badge ${clinic.status}`}><i />{labels[clinic.status]}</span>
          <div className="console-plan"><b>{clinic.plan_name}</b><small>{Object.values(clinic.enabled_modules).filter(Boolean).length} recursos liberados</small></div>
          <div className="admin-actions"><button disabled={working} onClick={() => setEditing(clinic)} aria-label={`Gerenciar ${clinic.name}`}>Gerenciar <span aria-hidden="true">↗</span></button><button disabled={working} onClick={() => exportBackup(clinic)} aria-label={`Baixar backup de ${clinic.name}`}>Backup</button><button disabled={working} onClick={() => changeStatus(clinic, clinic.status === "active" ? "suspended" : "active")} aria-label={`${clinic.status === "active" ? "Suspender" : "Ativar"} ${clinic.name}`}>{clinic.status === "active" ? "Suspender" : "Ativar"}</button></div>
        </article>)}
        <footer className="console-pagination"><span>{filtered.length ? `${(currentPage - 1) * 8 + 1}–${Math.min(currentPage * 8, filtered.length)} de ${filtered.length} clínica(s)` : "0 clínicas"}</span><div><button type="button" disabled={currentPage <= 1} aria-label="Página anterior" onClick={() => setPage(currentPage - 1)}>←</button><span>{currentPage} / {totalPages}</span><button type="button" disabled={currentPage >= totalPages} aria-label="Próxima página" onClick={() => setPage(currentPage + 1)}>→</button></div></footer>
      </section>
      <footer className="console-footer"><span>Medix · Administração da plataforma</span><span>As alterações de acesso se aplicam à clínica selecionada.</span></footer>
    </section>
    {editing && <ClinicEditor clinic={editing} close={() => setEditing(null)} saved={(text) => { setEditing(null); notice(text); void load(); }} remove={() => { const clinic = editing; setEditing(null); void removeClinic(clinic); }} />}
  </main>;
}

function ClinicEditor({ clinic, close, saved, remove }: { clinic: Clinic; close: () => void; saved: (message: string) => void; remove: () => void }) {
  const [name, setName] = useState(clinic.name); const [plan, setPlan] = useState(clinic.plan_name);
  const [modules, setModules] = useState<Modules>({ ...defaults, ...clinic.enabled_modules });
  const [alertTitle, setAlertTitle] = useState(clinic.admin_alert_title || ""); const [alertMessage, setAlertMessage] = useState(clinic.admin_alert_message || "");
  const [alertLevel, setAlertLevel] = useState(clinic.admin_alert_level || "info"); const [error, setError] = useState(""); const [saving, setSaving] = useState(false);
  const dialog = useRef<HTMLFormElement>(null);
  const closeRef = useRef(close);
  closeRef.current = close;
  const savingRef = useRef(saving);
  savingRef.current = saving;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const first = dialog.current?.querySelector<HTMLInputElement>('input');
    first?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !savingRef.current) { event.preventDefault(); closeRef.current(); }
      if (event.key !== "Tab") return;
      const focusable = Array.from(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled)') || []);
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = previousOverflow; previous?.focus(); };
  }, []);
  function toggle(key: keyof Modules) { setModules((current) => ({ ...current, [key]: !current[key] })); }
  async function save(event: FormEvent) {
    event.preventDefault(); setSaving(true); setError("");
    try { await api(`/v1/admin/clinics/${clinic.id}`, { method: "PATCH", body: JSON.stringify({ name: name.trim(), plan_name: plan.trim() || "Essencial", enabled_modules: modules, admin_alert_title: alertTitle.trim() || null, admin_alert_message: alertMessage.trim() || null, admin_alert_level: alertLevel }) }); saved(`${name.trim()} foi atualizada.`); } catch (error) { setError(error instanceof Error ? error.message : "Erro ao atualizar clínica."); } finally { setSaving(false); }
  }
  return <div className="admin-modal-layer"><form ref={dialog} className="admin-editor" role="dialog" aria-modal="true" aria-labelledby="clinic-editor-title" onSubmit={save}><button className="editor-close" aria-label="Fechar configurações" disabled={saving} type="button" onClick={close}>×</button><p>CONFIGURAÇÃO DA CLÍNICA</p><h2 id="clinic-editor-title">{clinic.name}</h2><span className="editor-subtitle">Personalize os recursos liberados e a comunicação da conta.</span>
    <div className="editor-grid"><label>Nome da clínica<input required value={name} onChange={(event) => setName(event.target.value)} /></label><label>Plano<input value={plan} onChange={(event) => setPlan(event.target.value)} /></label></div>
    <section className="editor-section"><h3>Recursos liberados</h3><div className="module-grid">{moduleLabels.map(({ key, label }) => <label key={key} className="module-toggle"><input type="checkbox" checked={modules[key]} onChange={() => toggle(key)} /><span>{label}</span></label>)}</div></section>
    <section className="editor-section"><h3>Alerta na visão geral</h3><p>Use para comunicar manutenção, pendências de pagamento, novidades ou orientações. Deixe título e mensagem vazios para remover o aviso.</p><div className="editor-grid"><label>Título<input value={alertTitle} onChange={(event) => setAlertTitle(event.target.value)} placeholder="Ex.: Atualização programada" /></label><label>Prioridade<select value={alertLevel} onChange={(event) => setAlertLevel(event.target.value as "info" | "warning" | "important")}><option value="info">Informativo</option><option value="warning">Atenção</option><option value="important">Importante</option></select></label><label className="wide">Mensagem<textarea value={alertMessage} onChange={(event) => setAlertMessage(event.target.value)} placeholder="Ex.: O sistema passará por manutenção no domingo, das 22h às 23h." /></label></div></section>
    <section className="console-danger-zone"><div><h3>Excluir clínica</h3><p>Remove permanentemente a clínica e seus dados.</p></div><button type="button" disabled={saving} onClick={remove}>Excluir clínica</button></section>
    {error && <div className="admin-notice console-notice error" role="alert">{error}</div>}<div className="editor-footer"><button type="button" disabled={saving} onClick={close}>Cancelar</button><button className="button" disabled={saving}>{saving ? "Salvando…" : "Salvar configurações"}</button></div>
  </form></div>;
}
