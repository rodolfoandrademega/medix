"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";
import "../../globals.css";
import "../admin.css";

export default function AdminLogin() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const client = supabase;
    if (!client) return;
    client.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const { data: allowed } = await client.rpc("is_platform_admin");
      if (allowed) router.replace("/admin");
    });
  }, [router]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!supabase) return setMessage("A conexão com o Supabase não foi encontrada.");
    setLoading(true); setMessage("");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) { setMessage("E-mail ou senha não conferem."); setLoading(false); return; }
    const { data: allowed } = await supabase.rpc("is_platform_admin");
    if (!allowed) {
      await supabase.auth.signOut();
      setMessage("Esta conta não possui acesso à administração da Medix.");
      setLoading(false);
      return;
    }
    router.replace("/admin");
  }

  return <main className="admin-login"><section><Link className="brand" href="/"><span className="brand-mark">M</span> medix</Link><div className="admin-login-card"><p>ÁREA RESTRITA</p><h1>Administração<br/>da plataforma</h1><span>Entre com a conta de super administrador para gerenciar clínicas, acessos e status.</span><form onSubmit={submit}><label>E-mail administrativo<input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></label><label>Senha<input type="password" required value={password} onChange={(event) => setPassword(event.target.value)} /></label>{message && <div className="admin-notice">{message}</div>}<button className="button" disabled={loading}>{loading ? "Verificando..." : "Entrar como super admin"} →</button></form></div></section></main>;
}
