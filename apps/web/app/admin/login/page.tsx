"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "../../../lib/api";
import { signIn, signOut } from "../../../lib/auth";
import "../../globals.css";
import "../admin.css";

export default function AdminLogin() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true); setMessage("");
    try { await signIn(email, password); } catch { setMessage("E-mail ou senha não conferem."); setLoading(false); return; }
    try { await api("/v1/admin/clinics"); } catch {
      await signOut();
      setMessage("Esta conta não possui acesso à administração da Medix.");
      setLoading(false);
      return;
    }
    router.replace("/admin");
  }

  return <main className="admin-login"><section><Link className="brand" href="/"><span className="brand-mark">M</span> medix</Link><div className="admin-login-card"><p>ÁREA RESTRITA</p><h1>Administração<br/>da plataforma</h1><span>Entre com a conta de super administrador para gerenciar clínicas, acessos e status.</span><form onSubmit={submit}><label>E-mail administrativo<input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></label><label>Senha<input type="password" required value={password} onChange={(event) => setPassword(event.target.value)} /></label>{message && <div className="admin-notice">{message}</div>}<button className="button" disabled={loading}>{loading ? "Verificando..." : "Entrar como super admin"} →</button></form></div></section></main>;
}
