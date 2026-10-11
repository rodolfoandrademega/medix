"use client";
import { useEffect, useState } from "react";
import { api } from "../../lib/api";

type Recipient = { id: string; name: string; role: string };
export function AppointmentRecipients({ clinic, value, onChange, disabled = false }: { clinic: string; value: string[]; onChange: (ids: string[]) => void; disabled?: boolean }) {
  const [members, setMembers] = useState<Recipient[]>([]), [error, setError] = useState(""), [loading, setLoading] = useState(true);
  async function load() {
    setLoading(true); setError("");
    try { const result = await api<{ recipients: Recipient[] }>("/v1/appointments/recipients"); setMembers(result.recipients); }
    catch { setError("Não foi possível carregar os destinatários. Tente novamente antes de selecionar."); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, [clinic]);
  return <fieldset className="appointment-recipients" disabled={disabled}><legend>Quem deve receber os avisos?</legend><p>Selecione pessoas com acesso à agenda. Elas receberão avisos no painel ao agendar e quando o horário estiver próximo.</p>
    {loading ? <small>Carregando colaboradores…</small> : error ? <><small role="alert">{error}</small><button type="button" onClick={load}>Tentar novamente</button></> : <>
      <button type="button" onClick={() => onChange(value.length ? [] : members.map(member => member.id))}>{value.length ? "Limpar seleção" : "Selecionar todos"}</button>
      <div className="recipient-options">{members.map(member => <label key={member.id}><input type="checkbox" checked={value.includes(member.id)} onChange={event => onChange(event.target.checked ? [...value, member.id] : value.filter(id => id !== member.id))} /><span>{member.name}<small>{member.role === "owner" ? "Proprietário" : "Colaborador"}</small></span></label>)}</div>
      {!members.length && <small>Nenhum destinatário com acesso à agenda.</small>}
    </>}
  </fieldset>;
}
