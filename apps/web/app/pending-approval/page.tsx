"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "../../lib/api";
import "../globals.css";
import "../mobile.css";
import "../auth/auth.css";

export default function PendingApprovalPage() {
  const router = useRouter();
  const [clinic, setClinic] = useState("");
  const [status, setStatus] = useState("pending");

  async function check() {
    let workspace: { name: string; status: string } | null = null;
    try { workspace = (await api<{ workspace: { name: string; status: string } | null }>("/v1/workspace")).workspace; } catch { return router.replace("/auth"); }
    if (!workspace) return router.replace("/onboarding");
    setClinic(workspace.name);
    setStatus(workspace.status);
    if (workspace.status === "active") router.replace("/dashboard");
  }

  useEffect(() => { check(); }, []);
  const text = status === "suspended" ? "O acesso desta clínica está temporariamente suspenso." : status === "inactive" ? "Esta clínica está inativa. Fale com o administrador da plataforma." : "Seu cadastro foi recebido e está aguardando a liberação da Medix.";
  return <main className="auth-page"><section className="auth-aside"><Link href="/" className="brand"><span className="brand-mark">M</span> medix</Link><div><div className="eyebrow">Cadastro recebido</div><h1>Sua clínica está<br/><em>quase pronta.</em></h1><p>Assim que sua conta for liberada, você terá acesso a todos os recursos.</p></div></section><section className="auth-form-area"><div className="auth-card pending-card"><div className="pending-icon">✓</div><div className="eyebrow">Status da clínica</div><h2>{clinic || "Aguardando análise"}</h2><p>{text}</p><button className="button auth-submit" onClick={check}>Verificar liberação <span>↻</span></button><Link className="back-home pending-home" href="/">Voltar para o site</Link></div></section></main>;
}
