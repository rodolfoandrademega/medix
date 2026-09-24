"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../lib/supabase";
import "../auth/auth.css";

const slugify = (value:string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
const errorText = (error:unknown) => {
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") return error.message;
  return "Não foi possível carregar a sua conta.";
};

export default function Onboarding() {
  const router = useRouter();
  const [name, setName] = useState(""); const [slug, setSlug] = useState("");
  const [feedback, setFeedback] = useState(""); const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false);

  useEffect(() => { void checkWorkspace(); }, []);
  async function checkWorkspace() {
    try {
      if (!supabase) throw new Error("A conexão com o Supabase não foi encontrada.");
      const { data:{ user }, error:userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) { router.replace("/auth"); return; }
      const { data, error } = await supabase.from("clinic_members").select("clinic_id").eq("user_id", user.id).limit(1).maybeSingle();
      if (error) throw error;
      if (data?.clinic_id) { router.replace("/dashboard"); return; }
    } catch (error) { setFeedback(errorText(error)); }
    finally { setLoading(false); }
  }
  async function submit(event:FormEvent) {
    event.preventDefault(); setSaving(true); setFeedback("");
    try {
      if (!supabase) throw new Error("A conexão com o Supabase não foi encontrada.");
      const { error } = await supabase.rpc("create_clinic_with_owner", { clinic_name:name, clinic_slug:slug });
      if (error) throw error;
      router.replace("/dashboard");
    } catch (error) { setFeedback(errorText(error)); setSaving(false); }
  }
  if (loading) return <main className="loading-screen"><span className="brand-mark">M</span><p>Preparando sua Medix...</p></main>;
  return <main className="auth-page"><section className="auth-aside"><Link href="/" className="brand"><span className="brand-mark">M</span> medix</Link><div><div className="eyebrow">Primeiro passo</div><h1>Vamos criar<br/>sua <em>clínica.</em></h1><p>Você será o administrador e poderá convidar sua equipe logo depois.</p></div><div className="auth-quote">Seus dados permanecem privados e separados de todas as outras clínicas.</div></section><section className="auth-form-area"><div className="auth-card"><div className="eyebrow">Configuração inicial</div><h2>Qual é o nome da clínica?</h2><p>Você poderá editar essas informações nas configurações.</p><form onSubmit={submit}><label>Nome da clínica<input value={name} required onChange={e=>{setName(e.target.value);setSlug(slugify(e.target.value));}} placeholder="Ex.: Clínica Sorriso"/></label><label>Endereço da clínica<input value={slug} required onChange={e=>setSlug(slugify(e.target.value))} placeholder="clinica-sorriso"/><small>medix.app/{slug || "sua-clinica"}</small></label>{feedback && <div className="auth-feedback">{feedback}</div>}<button disabled={saving} className="button auth-submit">{saving ? "Criando..." : "Criar minha clínica"}<span>→</span></button></form></div></section></main>;
}
