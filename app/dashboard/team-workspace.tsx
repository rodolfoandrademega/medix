"use client";

import { FormEvent, useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import "./team-workspace.css";
import "./team-edit.css";

type PermissionKey = "patients" | "anamnesis" | "records" | "history" | "agenda" | "procedures" | "team" | "financial" | "reports";
type Permissions = Record<PermissionKey, boolean>;
type Member = { invite_id: string | null; user_id: string | null; full_name: string; email: string; member_role: "owner" | "admin" | "professional" | "receptionist"; permissions: Permissions; status: string; created_at: string; admin_alert_title?: string | null; admin_alert_message?: string | null; admin_alert_level?: "info" | "warning" | "important" };

const base: Permissions = { patients: true, anamnesis: false, records: false, history: true, agenda: true, procedures: false, team: false, financial: false, reports: false };
const labels: Record<PermissionKey, string> = { patients: "Pacientes", anamnesis: "Ficha de anamnese", records: "Prontuário", history: "Histórico", agenda: "Agenda", procedures: "Procedimentos", team: "Colaboradores", financial: "Financeiro", reports: "Relatórios" };
const roleLabels: Record<Member["member_role"], string> = { owner: "Proprietário", admin: "Gerente", professional: "Profissional", receptionist: "Recepção" };

export function TeamWorkspace() {
  const [members, setMembers] = useState<Member[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Member | null>(null);
  const [message, setMessage] = useState("");
  async function load() {
    const { data, error } = await supabase!.rpc("list_clinic_access");
    if (error) setMessage(error.message);
    else setMembers((data || []).map((item: Member) => ({ ...item, permissions: { ...base, ...item.permissions } })));
  }
  useEffect(() => { void load(); }, []);
  return <section className="team-workspace">
    <div className="team-module-head"><div><p className="section-kicker">EQUIPE DA CLÍNICA</p><h2>Colaboradores</h2><p>Crie acessos e determine exatamente o que cada pessoa pode consultar e alterar.</p></div><button className="new-button" onClick={() => setOpen(true)}>＋ Novo colaborador</button></div>
    {message && <div className="team-notice">{message}</div>}
    <section className="team-list">{members.map((member) => <article key={member.user_id || member.invite_id}><span className="team-avatar">{(member.full_name || member.email).slice(0, 2).toUpperCase()}</span><div><b>{member.full_name || "Convite pendente"}</b><small>{member.email} · {roleLabels[member.member_role]}{member.admin_alert_title ? " · alerta ativo" : ""}</small></div><span className={member.status === "active" ? "team-status" : "team-status pending"}>{member.status === "active" ? "Ativo" : "Aguardando cadastro"}</span><span className="team-permission-count">{Object.values(member.permissions).filter(Boolean).length} acessos</span>{member.user_id && member.member_role !== "owner" && <button className="team-edit" onClick={() => setEditing(member)}>Editar</button>}</article>)}{!members.length && <p className="team-empty">Nenhum colaborador cadastrado.</p>}</section>
    {open && <InviteEditor close={() => setOpen(false)} done={(text) => { setOpen(false); setMessage(text); void load(); }} />}
    {editing && <MemberEditor member={editing} close={() => setEditing(null)} done={(text) => { setEditing(null); setMessage(text); void load(); }} />}
  </section>;
}

function MemberEditor({ member, close, done }: { member: Member; close: () => void; done: (text: string) => void }) {
  const [role, setRole] = useState<"admin" | "professional" | "receptionist">(member.member_role as "admin" | "professional" | "receptionist"); const [permissions, setPermissions] = useState<Permissions>({ ...base, ...member.permissions }); const [title, setTitle] = useState(member.admin_alert_title || ""); const [message, setMessage] = useState(member.admin_alert_message || ""); const [level, setLevel] = useState<"info" | "warning" | "important">(member.admin_alert_level || "info"); const [error, setError] = useState(""); const [saving, setSaving] = useState(false);
  const toggle = (key: PermissionKey) => setPermissions((current) => ({ ...current, [key]: !current[key] }));
  async function save(event: FormEvent) { event.preventDefault(); setSaving(true); setError(""); const { error: updateError } = await supabase!.rpc("update_clinic_member_access", { target_user: member.user_id, target_role: role, target_permissions: permissions, target_alert_title: title, target_alert_message: message, target_alert_level: level }); setSaving(false); if (updateError) setError(updateError.message); else done("Acesso e alerta do colaborador atualizados."); }
  return <div className="team-modal-layer"><form className="team-editor" onSubmit={save}><button type="button" className="team-close" onClick={close}>×</button><p>EDITAR COLABORADOR</p><h2>{member.full_name || member.email}</h2><span>Altere a função, os recursos liberados e uma mensagem exclusiva para esta pessoa.</span><label>Função<select value={role} onChange={(event) => setRole(event.target.value as typeof role)}><option value="professional">Profissional</option><option value="receptionist">Recepção</option><option value="admin">Gerente</option></select></label><h3>Permissões individuais</h3><div className="permission-grid">{(Object.keys(labels) as PermissionKey[]).map((key) => <label key={key}><input type="checkbox" checked={permissions[key]} onChange={() => toggle(key)} />{labels[key]}</label>)}</div><h3>Alerta individual</h3><label>Título<input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Ex.: Aviso para sua agenda" /></label><label>Mensagem<input value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Esta mensagem aparece somente para este colaborador." /></label><label>Prioridade<select value={level} onChange={(event) => setLevel(event.target.value as typeof level)}><option value="info">Informativo</option><option value="warning">Atenção</option><option value="important">Importante</option></select></label>{error && <div className="team-notice">{error}</div>}<div className="team-editor-actions"><button type="button" onClick={close}>Cancelar</button><button className="button" disabled={saving}>{saving ? "Salvando…" : "Salvar alterações"}</button></div></form></div>;
}

function InviteEditor({ close, done }: { close: () => void; done: (text: string) => void }) {
  const [email, setEmail] = useState(""); const [password, setPassword] = useState("");
  const [role, setRole] = useState<"admin" | "professional" | "receptionist">("professional");
  const [permissions, setPermissions] = useState<Permissions>(base); const [error, setError] = useState(""); const [saving, setSaving] = useState(false);
  const toggle = (key: PermissionKey) => setPermissions((current) => ({ ...current, [key]: !current[key] }));
  async function save(event: FormEvent) {
    event.preventDefault(); setSaving(true); setError("");
    try {
      const { data: { session } } = await supabase!.auth.getSession();
      if (!session) throw new Error("Sua sessão expirou. Entre novamente para continuar.");
      const response = await fetch("/api/team/create-access", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify({ email, password, role, permissions }) });
      const result = await response.json() as { message?: string };
      if (!response.ok) throw new Error(result.message || "Não foi possível criar o acesso.");
      done(result.message || "Acesso criado e enviado para o colaborador.");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Não foi possível criar o acesso."); } finally { setSaving(false); }
  }
  return <div className="team-modal-layer"><form className="team-editor" onSubmit={save}>
    <button type="button" className="team-close" onClick={close}>×</button><p>NOVO COLABORADOR</p><h2>Login e permissões</h2><span>Crie o login, a senha e selecione exatamente o que esta pessoa poderá acessar na clínica.</span>
    <label>Login (e-mail)<input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="pessoa@clinica.com" autoComplete="username" /></label>
    <label>Senha<input required type="password" minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="No mínimo 8 caracteres" autoComplete="new-password" /></label>
    <label>Função<select value={role} onChange={(event) => setRole(event.target.value as typeof role)}><option value="professional">Profissional</option><option value="receptionist">Recepção</option><option value="admin">Gerente</option></select></label>
    <h3>Permissões individuais</h3><div className="permission-grid">{(Object.keys(labels) as PermissionKey[]).map((key) => <label key={key}><input type="checkbox" checked={permissions[key]} onChange={() => toggle(key)} />{labels[key]}</label>)}</div>
    {error && <div className="team-notice error">{error}</div>}<div className="team-editor-actions"><button type="button" onClick={close}>Cancelar</button><button className="button" disabled={saving}>{saving ? "Criando…" : "Criar acesso"}</button></div>
  </form></div>;
}
