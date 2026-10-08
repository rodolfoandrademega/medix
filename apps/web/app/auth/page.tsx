"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useState } from "react";
import { resetPassword, signIn, signUp, updatePassword } from "../../lib/auth";
import { supabase } from "../../lib/supabase";
import "./auth-redesign.css";

type IconName = "arrow" | "back" | "mail" | "lock" | "user" | "eye" | "eye-off" | "check" | "calendar" | "shield";
function AuthIcon({ name }: { name: IconName }) {
  const paths = {
    arrow: <path d="M5 12h14m-6-6 6 6-6 6" />,
    back: <path d="M19 12H5m6-6-6 6 6 6" />,
    mail: <><rect x="3" y="5" width="18" height="14" rx="3" /><path d="m3 7 9 6 9-6" /></>,
    lock: <><rect x="5" y="10" width="14" height="11" rx="3" /><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3" /></>,
    user: <><circle cx="12" cy="8" r="4" /><path d="M4 21v-2a8 8 0 0 1 16 0v2" /></>,
    eye: <><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></>,
    "eye-off": <><path d="m3 3 18 18M10 5a11 11 0 0 1 12 7s-1 2-3 4M6 6a20 20 0 0 0-4 6s4 7 10 7c2 0 4-1 5-2M10 10a3 3 0 0 0 4 4" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M7 3v4M17 3v4M3 10h18M8 15h2M14 15h2" /></>,
    shield: <><path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Z" /><path d="m8 12 3 3 5-6" /></>,
  };
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

export default function AuthPage() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [recovering, setRecovering] = useState(false);
  const [requestingReset, setRequestingReset] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [feedbackKind, setFeedbackKind] = useState<"error" | "success">("error");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("mode") === "signup") setMode("signup");
    const subscription = supabase?.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setRecovering(true);
        setRequestingReset(false);
        setFeedback("");
        setShowPassword(false);
      }
    }).data.subscription;
    return () => subscription?.unsubscribe();
  }, []);

  function changeMode(nextMode: "login" | "signup") {
    setMode(nextMode);
    setRequestingReset(false);
    setPassword("");
    setShowPassword(false);
    setFeedback("");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback("");
    setLoading(true);
    try {
      if (requestingReset) {
        await resetPassword(email.trim());
        setFeedbackKind("success");
        setFeedback("Se este e-mail estiver cadastrado, você receberá um link para criar uma nova senha. Confira também a caixa de spam.");
        return;
      }
      if (recovering) await updatePassword(password);
      else if (mode === "signup") await signUp(fullName.trim(), email.trim(), password);
      else await signIn(email.trim(), password);
      router.push("/onboarding");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Não foi possível continuar. Tente novamente.";
      setFeedbackKind("error");
      setFeedback(/invalid-credential|invalid login/i.test(message) ? "E-mail ou senha não conferem. Revise seus dados e tente novamente." : message);
    } finally {
      setLoading(false);
    }
  }

  const title = recovering ? "Crie uma nova senha." : requestingReset ? "Vamos recuperar seu acesso." : mode === "login" ? "Bom ter você de volta." : "Uma nova rotina começa aqui.";
  const description = recovering ? "Escolha uma senha com pelo menos 8 caracteres para voltar à sua clínica." : requestingReset ? "Informe o e-mail da sua conta. Enviaremos as instruções para redefinir sua senha." : mode === "login" ? "Entre na sua conta e acompanhe o dia da sua clínica." : "Crie seu acesso e dê o primeiro passo para organizar sua clínica.";

  return <main className="mx-auth">
    <section className="mx-auth-story" aria-label="Conheça a Medix">
      <div className="mx-auth-story-top"><Link href="/" className="mx-auth-brand" aria-label="Medix, página inicial"><span className="mx-auth-logo">m<span>+</span></span>medix<span className="mx-auth-brand-dot">.</span></Link><span className="mx-auth-story-label">FEITA PARA QUEM CUIDA</span></div>
      <div className="mx-auth-story-content"><span className="mx-auth-eyebrow"><i /> SUA CLÍNICA, EM SINTONIA</span><h1>Mais perto{" "}<br />da sua equipe.<br /><span>Mais tempo{" "}<br />para cuidar.</span></h1><p>Agenda, pacientes e equipe conectados para uma rotina com mais clareza e menos complicação.</p>
        <div className="mx-auth-preview" aria-hidden="true"><div className="mx-auth-preview-heading"><span><AuthIcon name="calendar" /> Uma rotina que flui</span><span className="mx-auth-preview-badge">Tudo conectado</span></div><div className="mx-auth-preview-row"><span className="mx-auth-preview-icon"><AuthIcon name="calendar" /></span><div><strong>Agenda organizada</strong><small>Cada atendimento no seu lugar.</small></div><span className="mx-auth-preview-check"><AuthIcon name="check" /></span></div><div className="mx-auth-preview-row"><span className="mx-auth-preview-icon mint"><AuthIcon name="user" /></span><div><strong>Cuidado com continuidade</strong><small>Informações do paciente à mão.</small></div><span className="mx-auth-preview-check"><AuthIcon name="check" /></span></div><div className="mx-auth-preview-row"><span className="mx-auth-preview-icon peach"><AuthIcon name="shield" /></span><div><strong>Equipe alinhada</strong><small>Acessos conforme cada função.</small></div><span className="mx-auth-preview-check"><AuthIcon name="check" /></span></div></div>
      </div>
      <div className="mx-auth-story-footer"><span className="mx-auth-footer-mark">+</span><span>Tecnologia que aproxima.<br /><strong>Cuidado que evolui.</strong></span><span className="mx-auth-footer-line" /></div>
    </section>

    <section className="mx-auth-form-area" aria-label="Acesso à Medix">
      <div className="mx-auth-topbar"><Link href="/" className="mx-auth-back"><AuthIcon name="back" /> Voltar para o site</Link><span>Gestão que cuida de pessoas.</span></div>
      <div className="mx-auth-card">
        {!recovering && !requestingReset && <div className="mx-auth-switch" role="group" aria-label="Tipo de acesso"><button type="button" disabled={loading} aria-pressed={mode === "login"} className={mode === "login" ? "active" : ""} onClick={() => changeMode("login")}>Entrar</button><button type="button" disabled={loading} aria-pressed={mode === "signup"} className={mode === "signup" ? "active" : ""} onClick={() => changeMode("signup")}>Criar conta</button></div>}
        <span className="mx-auth-form-eyebrow">{recovering || requestingReset ? "RECUPERE SEU ACESSO" : mode === "login" ? "SEU DIA COMEÇA POR AQUI" : "BEM-VINDO À MEDIX"}</span>
        <h2>{title}</h2><p className="mx-auth-description">{description}</p>
        <form onSubmit={submit} aria-busy={loading}>
          {!recovering && !requestingReset && mode === "signup" && <div className="mx-auth-field"><label htmlFor="auth-name">Seu nome</label><div className="mx-auth-input"><AuthIcon name="user" /><input id="auth-name" name="fullName" value={fullName} onChange={(event) => setFullName(event.target.value)} required autoComplete="name" placeholder="Como podemos te chamar?" disabled={loading} /></div></div>}
          {!recovering && <div className="mx-auth-field"><label htmlFor="auth-email">E-mail profissional</label><div className="mx-auth-input"><AuthIcon name="mail" /><input id="auth-email" name="email" value={email} onChange={(event) => setEmail(event.target.value)} required type="email" autoComplete={mode === "login" ? "username" : "email"} autoCapitalize="none" spellCheck={false} placeholder="voce@clinica.com.br" disabled={loading} /></div></div>}
          {!requestingReset && <div className="mx-auth-field"><div className="mx-auth-label-row"><label htmlFor="auth-password">{recovering ? "Nova senha" : "Senha"}</label>{!recovering && mode === "login" && <button type="button" className="mx-auth-forgot" disabled={loading} onClick={() => { setRequestingReset(true); setFeedback(""); setPassword(""); setShowPassword(false); }}>Esqueceu a senha?</button>}</div><div className="mx-auth-input"><AuthIcon name="lock" /><input id="auth-password" name="password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={recovering || mode === "signup" ? 8 : undefined} type={showPassword ? "text" : "password"} autoComplete={recovering || mode === "signup" ? "new-password" : "current-password"} placeholder={recovering || mode === "signup" ? "Crie uma senha" : "Digite sua senha"} aria-describedby={recovering || mode === "signup" ? "auth-password-hint" : undefined} disabled={loading} /><button type="button" className="mx-auth-password-toggle" aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"} aria-pressed={showPassword} onClick={() => setShowPassword(!showPassword)} disabled={loading}><AuthIcon name={showPassword ? "eye-off" : "eye"} /></button></div>{(recovering || mode === "signup") && <small id="auth-password-hint" className="mx-auth-field-hint">Use pelo menos 8 caracteres.</small>}</div>}
          {feedback && <div className={`mx-auth-feedback ${feedbackKind}`} role={feedbackKind === "error" ? "alert" : "status"}>{feedbackKind === "success" && <AuthIcon name="check" />}<span>{feedback}</span></div>}
          <button type="submit" disabled={loading} className="mx-auth-submit"><span>{loading ? "Aguarde…" : recovering ? "Salvar nova senha" : requestingReset ? "Enviar link de recuperação" : mode === "login" ? "Entrar na Medix" : "Criar minha conta"}</span>{loading ? <span className="mx-auth-spinner" aria-hidden="true" /> : <AuthIcon name="arrow" />}</button>
        </form>
        {requestingReset && <button type="button" className="mx-auth-return" disabled={loading} onClick={() => changeMode("login")}><AuthIcon name="back" /> Voltar para o login</button>}
        {!recovering && !requestingReset && <p className="mx-auth-alternate">{mode === "login" ? "Sua clínica ainda não está na Medix?" : "Já tem uma conta?"} <button type="button" disabled={loading} onClick={() => changeMode(mode === "login" ? "signup" : "login")}>{mode === "login" ? "Crie sua conta" : "Entre aqui"}</button></p>}
        {!recovering && !requestingReset && mode === "signup" && <p className="mx-auth-terms">Ao criar sua conta, você concorda com os Termos de uso e a Política de privacidade da Medix.</p>}
        <div className="mx-auth-browser-note"><AuthIcon name="shield" /><span>Seu ambiente de cuidado, direto no navegador.</span></div>
      </div>
      <footer className="mx-auth-help"><span>Precisa de uma mão?</span><a href="mailto:contato@medix.app">Fale com a gente <span>↗</span></a></footer>
    </section>
  </main>;
}
