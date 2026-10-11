"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "../../lib/api";
import { signOut } from "../../lib/auth";
import { rememberClinic } from "../../lib/clinic-selection";
import "../auth/auth-redesign.css";
import "./pending-approval.css";

export default function PendingApprovalPage() {
  const router = useRouter();
  const [clinic, setClinic] = useState("");
  const [status, setStatus] = useState("pending");
  const [checking, setChecking] = useState(true);
  const [checked, setChecked] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [leaving, setLeaving] = useState(false);

  const check = useCallback(async () => {
    setChecking(true); setFeedback("");
    try {
      const { workspace } = await api<{ workspace: { id: string; name: string; status: string } | null }>("/v1/workspace");
      if (!workspace) { router.replace("/onboarding"); return; }
      await rememberClinic(workspace.id);
      setClinic(workspace.name);
      setStatus(workspace.status);
      setChecked(true);
      if (workspace.status === "active") router.replace("/dashboard");
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) router.replace("/auth");
      else setFeedback("Não foi possível consultar o status agora. Tente novamente em alguns instantes.");
    } finally { setChecking(false); }
  }, [router]);

  async function exit() {
    setLeaving(true); setFeedback("");
    try { await signOut(); router.replace("/auth"); }
    catch { setFeedback("Não foi possível sair. Tente novamente."); setLeaving(false); }
  }

  useEffect(() => { void check(); }, [check]);
  const paused = status === "suspended" || status === "inactive";
  const statusLabel = !checked ? "Consultando cadastro" : status === "suspended" ? "Acesso suspenso" : status === "inactive" ? "Clínica inativa" : status === "active" ? "Acesso liberado" : "Aguardando aprovação";
  const text = status === "suspended" ? "O acesso desta clínica está temporariamente suspenso. Entre em contato com a Medix para saber como regularizar a situação." : status === "inactive" ? "Esta clínica está inativa. Fale com a Medix para solicitar a reativação do acesso." : status === "active" ? "Sua clínica foi liberada. Estamos abrindo seu painel." : "Seu cadastro foi recebido. A equipe Medix precisa liberar a clínica para você começar a usar o painel.";
  return <main className="mx-auth mx-pending">
    <section className="mx-auth-story" aria-label="Acompanhamento da clínica">
      <div className="mx-auth-story-top"><Link href="/" className="mx-auth-brand" aria-label="Medix, página inicial"><span className="mx-auth-logo">m<span>+</span></span>medix<span className="mx-auth-brand-dot">.</span></Link><span className="mx-auth-story-label">FEITA PARA QUEM CUIDA</span></div>
      <div className="mx-auth-story-content"><span className="mx-auth-eyebrow"><i /> {paused ? "VAMOS RETOMAR SUA ROTINA" : "O PRÓXIMO PASSO ESTÁ MAIS PERTO"}</span><h1>{paused ? <>Seu cuidado.<br /><span>Vamos seguir<br />juntos.</span></> : <>Sua clínica.<br /><span>Uma nova rotina<br />vem aí.</span></>}</h1><p>{paused ? "Nossa equipe pode orientar você sobre o acesso da sua clínica. Acompanhe a situação por aqui." : "Seu espaço já começou a ganhar forma. Após a aprovação, organize a agenda, acompanhe seus pacientes e conecte a equipe."}</p><div className="mx-pending-preview"><span aria-hidden="true">+</span><div><strong>Mais clareza para cuidar.</strong><p>Agenda, pacientes e equipe em um só lugar.</p></div></div></div>
      <div className="mx-auth-story-footer"><span className="mx-auth-footer-mark" aria-hidden="true">+</span><span>Tecnologia que aproxima.<br /><strong>Cuidado que evolui.</strong></span><span className="mx-auth-footer-line" /></div>
    </section>
    <section className="mx-auth-form-area" aria-label="Status do cadastro">
      <div className="mx-auth-topbar"><Link href="/" className="mx-auth-back">← Voltar para o site</Link><button type="button" className="mx-pending-exit" disabled={leaving || checking} onClick={() => void exit()}>{leaving ? "Saindo…" : "Sair da conta ↗"}</button></div>
      <div className="mx-auth-card" aria-busy={checking}>
        <div className={`mx-pending-symbol ${paused ? "paused" : ""}`} aria-hidden="true"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" />{paused ? <path d="M12 7v6m0 4h.01" /> : <path d="M12 7v5l3 2" />}</svg></div>
        <span className="mx-auth-form-eyebrow">STATUS DA SUA CLÍNICA</span>
        <h2>{clinic || "Acompanhe seu cadastro."}</h2>
        <div className={`mx-pending-status ${paused ? "paused" : ""}`} role="status"><i />{checking ? "Verificando status…" : statusLabel}</div>
        <p className="mx-auth-description">{checked ? text : "Estamos consultando as informações da sua clínica para mostrar a situação atual."}</p>
        {checked && !paused && status !== "active" && <ol className="mx-pending-timeline" aria-label="Etapas da liberação"><li className="complete"><span aria-hidden="true">✓</span><div><strong>Cadastro recebido</strong><p>As informações da clínica foram enviadas.</p></div></li><li className="current"><span aria-hidden="true">2</span><div><strong>Aprovação da Medix</strong><p>Seu cadastro aguarda a liberação da equipe.</p></div></li><li><span aria-hidden="true">3</span><div><strong>Acesso ao painel</strong><p>Após a ativação, sua clínica pode começar.</p></div></li></ol>}
        {feedback && <div className="mx-auth-feedback error" role="alert">{feedback}</div>}
        <button type="button" className="mx-auth-submit" disabled={checking || leaving} onClick={() => void check()}><span>{checking ? "Consultando sua clínica…" : paused ? "Verificar situação" : "Verificar liberação"}</span>{checking ? <span className="mx-auth-spinner" aria-hidden="true" /> : <span aria-hidden="true">↻</span>}</button>
        <p className="mx-pending-note">Ao verificar, você será direcionado ao painel se o acesso já estiver liberado.</p>
      </div>
      <footer className="mx-auth-help"><span>Precisa de ajuda com a liberação?</span><a href="mailto:contato@medix.app">Fale com a gente ↗</a></footer>
    </section>
  </main>;
}
