"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import "../globals.css";
import "../mobile.css";
import "./admin.css";

type Clinic = { id: string; name: string; status: "pending" | "active" | "suspended" | "inactive"; plan_name: string; created_at: string };
const label: Record<Clinic["status"], string> = { pending: "Pendente", active: "Ativa", suspended: "Suspensa", inactive: "Inativa" };

export default function AdminPage() {
  const router = useRouter();
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  async function load() {
    if (!supabase) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return router.replace("/admin/login");
    const { data: allowed } = await supabase.rpc("is_platform_admin");
    if (!allowed) return router.replace("/admin/login");
    setName(user.user_metadata.full_name || user.email || "Administrador");
    const { data, error } = await supabase.from("clinics").select("id,name,status,plan_name,created_at").order("created_at", { ascending: false });
    if (error) setMessage(error.message); else setClinics((data || []) as Clinic[]);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);
  async function changeStatus(clinic: Clinic, status: Clinic["status"]) {
    setMessage("");
    const { error } = await supabase!.from("clinics").update({ status, status_updated_at: new Date().toISOString() }).eq("id", clinic.id);
    if (error) setMessage(error.message); else { setMessage(clinic.name + " atualizada."); load(); }
  }
  const counts = (status: Clinic["status"]) => clinics.filter((clinic) => clinic.status === status).length;
  return <main className="admin-page"><header><Link href="/" className="brand"><span className="brand-mark">M</span> medix</Link><div><span>Super admin</span><b>{name}</b></div></header><section className="admin-content"><div className="admin-title"><div><p>ADMINISTRAÇÃO DA PLATAFORMA</p><h1>Clínicas e liberações</h1><span>Controle quem pode usar a Medix.</span></div><Link href="/dashboard" className="admin-back">Ir para minha clínica →</Link></div><div className="admin-metrics"><article><span>Pendentes</span><b>{counts("pending")}</b></article><article><span>Ativas</span><b>{counts("active")}</b></article><article><span>Suspensas</span><b>{counts("suspended")}</b></article><article><span>Inativas</span><b>{counts("inactive")}</b></article></div>{message && <div className="admin-notice">{message}</div>}<section className="admin-table"><header><h2>Empresas cadastradas</h2><span>{clinics.length} clínica(s)</span></header>{loading ? <p className="admin-empty">Carregando clínicas…</p> : clinics.map((clinic) => <article key={clinic.id}><div><b>{clinic.name}</b><small>Plano {clinic.plan_name} · cadastro em {new Intl.DateTimeFormat("pt-BR").format(new Date(clinic.created_at))}</small></div><span className={"status-badge " + clinic.status}>{label[clinic.status]}</span><div className="admin-actions"><button onClick={() => changeStatus(clinic, "active")}>Ativar</button><button onClick={() => changeStatus(clinic, "suspended")}>Suspender</button><button onClick={() => changeStatus(clinic, "inactive")}>Inativar</button></div></article>)}</section></section></main>;
}
