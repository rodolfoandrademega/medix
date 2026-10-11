"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "../../lib/api";
import { rememberClinic } from "../../lib/clinic-selection";
import "../auth/auth-redesign.css";
import "./onboarding.css";

const slugify = (value:string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
const errorText = (error:unknown) => {
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") return error.message;
  return "Não foi possível carregar a sua conta.";
};

export default function Onboarding() {
  const router = useRouter();
  const [name, setName] = useState(""); const [slug, setSlug] = useState("");
  const [feedback, setFeedback] = useState(""); const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => { void checkWorkspace(); }, []);
  async function checkWorkspace() {
    setLoading(true); setLoadFailed(false); setFeedback("");
    try {
      const { workspace } = await api<{ workspace: { id: string; status: string } | null }>("/v1/workspace");
      if (workspace?.id) { await rememberClinic(workspace.id); router.replace(workspace.status === "active" ? "/dashboard" : "/pending-approval"); return; }
    } catch (error) { setLoadFailed(true); setFeedback(errorText(error)); }
    finally { setLoading(false); }
  }
  async function submit(event:FormEvent) {
    event.preventDefault(); setSaving(true); setFeedback("");
    if (loadFailed) { setSaving(false); return; }
    try {
      const { clinic } = await api<{ clinic: { id: string } }>("/v1/clinics", { method: "POST", body: JSON.stringify({ name, slug }) });
      await rememberClinic(clinic.id);
      router.replace("/pending-approval");
    } catch (error) { setFeedback(errorText(error)); setSaving(false); }
  }
  return <main className="mx-auth mx-onboarding">
    <section className="mx-auth-story" aria-label="Configure sua clínica">
      <div className="mx-auth-story-top"><Link href="/" className="mx-auth-brand" aria-label="Medix, página inicial"><span className="mx-auth-logo">m<span>+</span></span>medix<span className="mx-auth-brand-dot">.</span></Link><span className="mx-auth-story-label">FEITA PARA QUEM CUIDA</span></div>
      <div className="mx-auth-story-content"><span className="mx-auth-eyebrow"><i /> UM NOVO COMEÇO PARA SUA CLÍNICA</span><h1>Seu cuidado.<br /><span>Agora, mais<br />conectado.</span></h1><p>Prepare o espaço da sua clínica na Medix. Depois da liberação, reúna pacientes, organize a agenda e conecte sua equipe.</p>
        <ol className="mx-onboarding-steps" aria-label="Etapas para começar">{[
          ["01", "Identifique sua clínica", "Informe o nome e escolha um identificador."],
          ["02", "Aguarde a liberação", "Seu cadastro será analisado pela equipe Medix."],
          ["03", "Organize sua rotina", "Com o acesso liberado, prepare a agenda e a equipe."],
        ].map(([number, title, description], index) => <li key={number} className={index === 0 ? "current" : ""}><span>{number}</span><div><strong>{title}</strong><p>{description}</p></div></li>)}</ol>
      </div>
      <div className="mx-auth-story-footer"><span className="mx-auth-footer-mark" aria-hidden="true">+</span><span>Um espaço para sua equipe.<br /><strong>Mais clareza para cada atendimento.</strong></span><span className="mx-auth-footer-line" /></div>
    </section>
    <section className="mx-auth-form-area" aria-label="Cadastro da clínica">
      <div className="mx-auth-topbar"><Link href="/" className="mx-auth-back">← Voltar para o site</Link><span>Medix · Configuração inicial</span></div>
      <div className="mx-auth-card">
        <div className="mx-onboarding-progress"><span>SEU ESPAÇO NA MEDIX</span><span>Primeiro passo</span></div>
        <h2>{loading ? "Preparando seu espaço." : "Vamos conhecer sua clínica."}</h2>
        <p className="mx-auth-description">{loading ? "Estamos verificando sua conta para continuar a configuração." : "Comece pelas informações da sua clínica. Você será o proprietário deste espaço."}</p>
        {loading ? <div className="mx-onboarding-loading" role="status"><span className="mx-auth-spinner" aria-hidden="true" /> Preparando sua Medix…</div> : <form onSubmit={submit} aria-busy={saving}>
          <div className="mx-auth-field"><label htmlFor="clinic-name">Nome da clínica</label><div className="mx-auth-input"><input id="clinic-name" name="clinicName" value={name} required minLength={2} maxLength={120} disabled={saving} autoComplete="organization" onChange={event => { setName(event.target.value); setSlug(slugify(event.target.value)); }} placeholder="Ex.: Clínica Sorriso" /></div></div>
          <div className="mx-auth-field"><label htmlFor="clinic-slug">Identificador da clínica</label><div className="mx-auth-input"><span className="mx-onboarding-slash" aria-hidden="true">/</span><input id="clinic-slug" name="clinicSlug" value={slug} required maxLength={120} disabled={saving} autoCapitalize="none" autoCorrect="off" spellCheck={false} aria-describedby="clinic-slug-hint" onChange={event => setSlug(slugify(event.target.value))} placeholder="clinica-sorriso" /></div><small id="clinic-slug-hint" className="mx-auth-field-hint">Um identificador único para sua clínica. Use letras, números e hífens.</small></div>
          <div className="mx-onboarding-approval"><span aria-hidden="true">✓</span><div><strong>O próximo passo é a aprovação.</strong><p>Ao enviar, você poderá acompanhar a liberação do cadastro. O acesso ao painel começa após a ativação pela Medix.</p></div></div>
          {feedback && <div className="mx-auth-feedback error" role="alert">{feedback}</div>}
          {loadFailed ? <button type="button" className="mx-auth-submit" onClick={() => void checkWorkspace()}><span>Verificar conexão e tentar novamente</span><span aria-hidden="true">↻</span></button> : <button type="submit" disabled={saving} className="mx-auth-submit"><span>{saving ? "Enviando cadastro…" : "Criar minha clínica"}</span>{saving ? <span className="mx-auth-spinner" aria-hidden="true" /> : <span aria-hidden="true">→</span>}</button>}
        </form>}
      </div>
      <footer className="mx-auth-help"><span>Precisa de ajuda para começar?</span><a href="mailto:contato@medix.app">Fale com a gente ↗</a></footer>
    </section>
  </main>;
}
