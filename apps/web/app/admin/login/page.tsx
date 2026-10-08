"use client";

import { type FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, ApiError } from "../../../lib/api";
import { resetPassword, signIn, signOut } from "../../../lib/auth";
import "../../auth/auth-redesign.css";
import "./login.css";

function Icon({ name }: { name: "shield" | "arrow" | "back" | "mail" | "lock" | "eye" | "eye-off" }) {
  const paths = {
    shield: <><path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Z" /><path d="m8 12 3 3 5-6" /></>,
    arrow: <path d="M5 12h14m-6-6 6 6-6 6" />,
    back: <path d="M19 12H5m6-6-6 6 6 6" />,
    mail: <><rect x="3" y="5" width="18" height="14" rx="3" /><path d="m3 7 9 6 9-6" /></>,
    lock: <><rect x="5" y="10" width="14" height="11" rx="3" /><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3" /></>,
    eye: <><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></>,
    "eye-off": <><path d="m3 3 18 18M10 5a11 11 0 0 1 12 7s-1 2-3 4M6 6a20 20 0 0 0-4 6s4 7 10 7c2 0 4-1 5-2M10 10a3 3 0 0 0 4 4" /></>,
  };
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

export default function AdminLogin() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [message, setMessage] = useState("");
  const [messageKind, setMessageKind] = useState<"error" | "success">("error");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    setMessageKind("error");
    try {
      if (resetting) {
        await resetPassword(email.trim());
        setMessageKind("success");
        setMessage("Se este e-mail estiver cadastrado, você receberá um link para redefinir sua senha. Depois, volte a esta página para acessar o console.");
        return;
      }
      try {
        await signIn(email.trim(), password);
      } catch (error) {
        const detail = error instanceof Error ? error.message : "";
        setMessage(/invalid-credential|invalid login/i.test(detail) ? "E-mail ou senha não conferem. Revise seus dados ou recupere sua senha." : "Não foi possível entrar. Tente novamente em alguns instantes.");
        return;
      }
      try {
        await api("/v1/admin/clinics");
      } catch (error) {
        if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
          await signOut();
          setMessage(error.status === 403 ? "Esta conta não possui acesso de super admin. Use um e-mail autorizado para administrar a plataforma." : "Sua sessão expirou. Entre novamente.");
        } else {
          setMessage(error instanceof ApiError && error.kind === "configuration" ? "A conexão com a administração ainda não foi configurada. Entre em contato com o responsável pela Medix." : "A administração está indisponível no momento. Tente novamente em alguns instantes.");
        }
        return;
      }
      router.replace("/admin");
    } catch {
      setMessage(resetting ? "Não foi possível enviar o link. Tente novamente em alguns instantes." : "Não foi possível concluir o acesso. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  function changeView(reset: boolean) {
    setResetting(reset);
    setMessage("");
    setPassword("");
    setShowPassword(false);
  }

  return <main className="mx-auth mx-admin-login">
    <section className="mx-auth-story mx-admin-story" aria-label="Console administrativo">
      <div className="mx-auth-story-top"><Link href="/" className="mx-auth-brand" aria-label="Medix, página inicial"><span className="mx-auth-logo">m<span>+</span></span>medix<span className="mx-auth-brand-dot">.</span></Link><span className="mx-admin-console-label">CONSOLE</span></div>
      <div className="mx-auth-story-content"><span className="mx-auth-eyebrow"><i /> ADMINISTRAÇÃO DA PLATAFORMA</span><h1>Uma visão ampla.<br /><span>Controle em{" "}<br />cada detalhe.</span></h1><p>Um espaço dedicado a quem acompanha as clínicas e mantém a operação da Medix organizada.</p><div className="mx-admin-capabilities">{[
        ["01", "Clínicas e status", "Acompanhe cadastros, liberações e a situação de cada clínica."],
        ["02", "Módulos e comunicação", "Configure os recursos disponíveis e envie avisos para as clínicas."],
        ["03", "Operação da plataforma", "Gerencie atualizações e exporte os backups das clínicas."],
      ].map(([number, title, text]) => <div key={number}><span>{number}</span><div><strong>{title}</strong><p>{text}</p></div></div>)}</div></div>
      <div className="mx-auth-story-footer"><Icon name="shield" /><span>Ambiente exclusivo para<br /><strong>administradores autorizados.</strong></span><span className="mx-auth-footer-line" /></div>
    </section>
    <section className="mx-auth-form-area" aria-label="Acesso administrativo">
      <div className="mx-auth-topbar"><Link href="/" className="mx-auth-back"><Icon name="back" /> Voltar para o site</Link><span>Medix · Administração</span></div>
      <div className="mx-auth-card mx-admin-card">
        <span className="mx-admin-access-badge"><Icon name="shield" /> ACESSO RESTRITO</span>
        <h2>{resetting ? "Recupere seu acesso." : "Bem-vindo ao console."}</h2>
        <p className="mx-auth-description">{resetting ? "Informe o e-mail da sua conta administrativa para receber as instruções de recuperação." : "Entre com sua conta de super admin para gerenciar a plataforma Medix."}</p>
        <form onSubmit={submit} aria-busy={loading}>
          <div className="mx-auth-field"><label htmlFor="admin-email">E-mail administrativo</label><div className="mx-auth-input"><Icon name="mail" /><input id="admin-email" name="email" type="email" autoComplete="username" autoCapitalize="none" spellCheck={false} placeholder="Seu e-mail de administrador" required disabled={loading} value={email} onChange={(event) => setEmail(event.target.value)} /></div></div>
          {!resetting && <div className="mx-auth-field"><div className="mx-auth-label-row"><label htmlFor="admin-password">Senha</label><button type="button" className="mx-auth-forgot" disabled={loading} onClick={() => changeView(true)}>Esqueceu a senha?</button></div><div className="mx-auth-input"><Icon name="lock" /><input id="admin-password" name="password" type={showPassword ? "text" : "password"} autoComplete="current-password" placeholder="Digite sua senha" required disabled={loading} value={password} onChange={(event) => setPassword(event.target.value)} /><button type="button" className="mx-auth-password-toggle" disabled={loading} aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"} aria-pressed={showPassword} onClick={() => setShowPassword(!showPassword)}><Icon name={showPassword ? "eye-off" : "eye"} /></button></div></div>}
          {message && <div className={`mx-auth-feedback ${messageKind}`} role={messageKind === "error" ? "alert" : "status"}>{message}</div>}
          <button type="submit" className="mx-auth-submit" disabled={loading}><span>{loading ? "Aguarde…" : resetting ? "Enviar link de recuperação" : "Acessar console administrativo"}</span>{loading ? <span className="mx-auth-spinner" aria-hidden="true" /> : <Icon name="arrow" />}</button>
        </form>
        {resetting && <button type="button" className="mx-auth-return" disabled={loading} onClick={() => changeView(false)}><Icon name="back" /> Voltar para o acesso administrativo</button>}
        <div className="mx-admin-access-note"><Icon name="shield" /><p><strong>Seu acesso é verificado ao entrar.</strong>Somente contas autorizadas podem acessar a administração da plataforma.</p></div>
        <div className="mx-admin-clinic-link"><span>Quer acessar sua clínica?</span><Link href="/auth">Ir para o login da clínica <Icon name="arrow" /></Link></div>
      </div>
      <footer className="mx-auth-help"><span>Precisa de ajuda com o acesso?</span><a href="mailto:contato@medix.app">Fale com a gente ↗</a></footer>
    </section>
  </main>;
}
