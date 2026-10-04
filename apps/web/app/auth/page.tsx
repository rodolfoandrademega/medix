"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { resetPassword, signIn, signUp } from "../../lib/auth";
import "./auth.css";

export default function AuthPage() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [fullName, setFullName] = useState(""); const [email, setEmail] = useState(""); const [password, setPassword] = useState("");
  const [feedback, setFeedback] = useState(""); const [loading, setLoading] = useState(false); const router = useRouter();

  async function submit(event: FormEvent) {
    event.preventDefault(); setFeedback(""); setLoading(true);
    try {
      if (mode === "signup") await signUp(fullName, email, password); else await signIn(email, password);
      router.push("/onboarding");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Não foi possível entrar.";
      setFeedback(/invalid-credential|invalid login/i.test(message) ? "E-mail ou senha não conferem." : message);
    } finally { setLoading(false); }
  }

  async function forgot() {
    if (!email) return setFeedback("Digite seu e-mail primeiro.");
    try { await resetPassword(email); setFeedback("Enviamos as instruções para redefinir sua senha."); }
    catch (error) { setFeedback(error instanceof Error ? error.message : "Não foi possível enviar a recuperação."); }
  }

  return <main className="auth-page"><section className="auth-aside"><Link href="/" className="brand"><span className="brand-mark">M</span> medix</Link><div><div className="eyebrow">Cuidado que evolui</div><h1>Uma nova rotina<br/>começa <em>aqui.</em></h1><p>Mais organização para sua equipe, mais atenção para cada paciente.</p></div><div className="auth-quote">“A Medix nos trouxe a clareza que faltava para crescer.”<small>Dra. Carolina Mendes · Instituto Vitta</small></div></section><section className="auth-form-area"><Link className="back-home" href="/">← Voltar para o site</Link><div className="auth-card"><div className="auth-tabs"><button className={mode === "login" ? "active" : ""} onClick={() => { setMode("login"); setFeedback(""); }}>Entrar</button><button className={mode === "signup" ? "active" : ""} onClick={() => { setMode("signup"); setFeedback(""); }}>Criar conta</button></div><h2>{mode === "login" ? "Que bom ver você." : "Vamos começar."}</h2><p>{mode === "login" ? "Entre para acessar a sua clínica." : "Crie sua conta para configurar sua clínica."}</p><form onSubmit={submit}>{mode === "signup" && <label>Seu nome<input value={fullName} onChange={(event) => setFullName(event.target.value)} required placeholder="Como podemos te chamar?" /></label>}<label>E-mail profissional<input value={email} onChange={(event) => setEmail(event.target.value)} required type="email" placeholder="voce@clinica.com.br" /></label><label>Senha<input value={password} onChange={(event) => setPassword(event.target.value)} required minLength={8} type="password" placeholder="Mínimo de 8 caracteres" /></label>{mode === "login" && <button type="button" className="forgot" onClick={forgot}>Esqueci minha senha</button>}{feedback && <div className="auth-feedback">{feedback}</div>}<button disabled={loading} className="button auth-submit">{loading ? "Aguarde..." : mode === "login" ? "Entrar na Medix" : "Criar minha conta"}<span>→</span></button></form><small className="terms">Ao continuar, você concorda com os Termos de uso e a Política de privacidade da Medix.</small></div></section></main>;
}
