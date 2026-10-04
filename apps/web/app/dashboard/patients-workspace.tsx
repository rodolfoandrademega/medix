"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { api } from "../../lib/api";
import "./patients-workspace.css";
import "./patient-edit.css";

type Patient = {
  id: string; full_name: string; phone: string | null; email: string | null; created_at?: string;
  preferred_name?: string | null; birth_date?: string | null; cpf?: string | null; city?: string | null;
  state?: string | null; notes?: string | null; gender?: string | null; occupation?: string | null; address?: string | null; address_number?: string | null; address_complement?: string | null; neighborhood?: string | null; postal_code?: string | null; emergency_contact_name?: string | null; emergency_contact_phone?: string | null; referred_by?: string | null;
};
type Anamnesis = {
  main_complaint: string; allergies: string; current_medications: string; medical_conditions: string;
  previous_surgeries: string; family_history: string; lifestyle_notes: string; clinical_observations: string;
};
type Record = { id: string; title: string; content: string; occurred_at: string };
const emptyAnamnesis: Anamnesis = { main_complaint: "", allergies: "", current_medications: "", medical_conditions: "", previous_surgeries: "", family_history: "", lifestyle_notes: "", clinical_observations: "" };
const appointmentHistoryLabels: { [status: string]: string } = { scheduled: "Agendamento realizado", confirmed: "Consulta confirmada", completed: "Atendimento concluído", cancelled: "Agendamento cancelado", no_show: "Paciente não compareceu" };
const formatDate = (value?: string | null) => value ? new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value)) : "—";
const initials = (value: string) => value.split(" ").map((word) => word[0]).slice(0, 2).join("").toUpperCase();

export function PatientsWorkspace({ clinic, patients, onNew, onReload, permissions }: { clinic: string; patients: Patient[]; onNew: () => void; onReload: () => void; permissions: { anamnesis: boolean; records: boolean; history: boolean } }) {
  const [search, setSearch] = useState("");
  const [section, setSection] = useState<"patients" | "anamnesis" | "records" | "history">("patients");
  const [selected, setSelected] = useState<Patient | null>(null);
  const [editing, setEditing] = useState<Patient | null>(null);
  const [anamnesis, setAnamnesis] = useState<Anamnesis>(emptyAnamnesis);
  const [records, setRecords] = useState<Record[]>([]);
  const [history, setHistory] = useState<{ starts_at: string; status: string }[]>([]);
  const [notice, setNotice] = useState("");
  const [noteTitle, setNoteTitle] = useState("Evolução clínica");
  const [noteContent, setNoteContent] = useState("");
  const filtered = useMemo(() => patients.filter((patient) => (patient.full_name + " " + (patient.email || "") + " " + (patient.phone || "")).toLowerCase().includes(search.toLowerCase())), [patients, search]);

  async function loadPatientWorkspace(patient: Patient) {
    setSelected(patient);
    setNotice("");
    try {
      const result = await api<{ anamnesis: Partial<Anamnesis> | null; records: Record[]; history: { starts_at: string; status: string }[] }>(`/v1/patients/${patient.id}/details`);
      setAnamnesis({ ...emptyAnamnesis, ...(result.anamnesis || {}) });
      setRecords(result.records || []);
      setHistory(result.history || []);
    } catch (error) { setNotice(error instanceof Error ? error.message : "Erro ao carregar paciente."); }
  }

  useEffect(() => { if (selected) loadPatientWorkspace(selected); }, [clinic]);

  async function savePatient(event: FormEvent) {
    event.preventDefault();
    if (!editing) return;
    try { await api(`/v1/patients/${editing.id}`, { method: "PATCH", body: JSON.stringify({
      full_name: editing.full_name, phone: editing.phone, email: editing.email, preferred_name: editing.preferred_name,
      birth_date: editing.birth_date || null, cpf: editing.cpf, city: editing.city, state: editing.state, notes: editing.notes, gender: editing.gender, occupation: editing.occupation, address: editing.address, address_number: editing.address_number, address_complement: editing.address_complement, neighborhood: editing.neighborhood, postal_code: editing.postal_code, emergency_contact_name: editing.emergency_contact_name, emergency_contact_phone: editing.emergency_contact_phone, referred_by: editing.referred_by,
    }) }); } catch (error) { return setNotice(error instanceof Error ? error.message : "Erro ao atualizar paciente."); }
    setEditing(null); setNotice("Dados do paciente atualizados."); onReload();
    if (selected?.id === editing.id) setSelected(editing);
  }

  async function deletePatient(patient: Patient) {
    if (!window.confirm("Excluir " + patient.full_name + "? Esta ação removerá também os registros vinculados.")) return;
    try { await api(`/v1/patients/${patient.id}`, { method: "DELETE" }); } catch (error) { return setNotice(error instanceof Error ? error.message : "Erro ao excluir paciente."); }
    if (selected?.id === patient.id) setSelected(null);
    setNotice("Paciente excluído."); onReload();
  }

  async function saveAnamnesis(event: FormEvent) {
    event.preventDefault();
    if (!selected) return setNotice("Selecione um paciente.");
    try { const result = await api<{ message: string }>(`/v1/patients/${selected.id}/anamnesis`, { method: "PUT", body: JSON.stringify(anamnesis) }); setNotice(result.message); } catch (error) { setNotice(error instanceof Error ? error.message : "Erro ao salvar anamnese."); }
  }

  async function addRecord(event: FormEvent) {
    event.preventDefault();
    if (!selected) return setNotice("Selecione um paciente.");
    if (!noteContent.trim()) return setNotice("Descreva a evolução clínica.");
    try { await api(`/v1/patients/${selected.id}/records`, { method: "POST", body: JSON.stringify({ title: noteTitle, content: noteContent }) }); } catch (error) { return setNotice(error instanceof Error ? error.message : "Erro ao salvar prontuário."); }
    setNoteContent(""); setNoteTitle("Evolução clínica"); setNotice("Evolução adicionada ao prontuário."); loadPatientWorkspace(selected);
  }

  const chooseSection = (next: typeof section) => { setSection(next); if (selected) loadPatientWorkspace(selected); };
  const allowedSections = { patients: true, anamnesis: permissions.anamnesis, records: permissions.records, history: permissions.history };
  return <section className="patients-workspace">
    <div className="patient-module-head">
      <div><p className="section-kicker">GESTÃO DE PACIENTES</p><h2>Pacientes</h2><p>Cadastros, informações clínicas e histórico de atendimento.</p></div>
      <button className="new-button" onClick={onNew}>＋ Novo paciente</button>
    </div>
    <nav className="patient-tabs">
      <button className={section === "patients" ? "active" : ""} onClick={() => chooseSection("patients")}>Pacientes</button>
      {allowedSections.anamnesis && <button className={section === "anamnesis" ? "active" : ""} onClick={() => chooseSection("anamnesis")}>Ficha de anamnese</button>}
      {allowedSections.records && <button className={section === "records" ? "active" : ""} onClick={() => chooseSection("records")}>Prontuário</button>}
      {allowedSections.history && <button className={section === "history" ? "active" : ""} onClick={() => chooseSection("history")}>Histórico</button>}
    </nav>
    {notice && <div className="patient-notice">{notice}</div>}
    {section === "patients" && <div className="patient-list-panel">
      <div className="patient-list-tools"><div className="patient-search">⌕ <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por nome, telefone ou e-mail" /></div><span>{filtered.length} registro(s)</span></div>
      <div className="patient-table-head"><span>Paciente</span><span>Contato</span><span>Cadastro</span><span>Ações</span></div>
      <div className="patient-table">{filtered.map((patient) => <article key={patient.id} className="patient-table-row">
        <button className="patient-open" onClick={() => { loadPatientWorkspace(patient); setSection(allowedSections.anamnesis ? "anamnesis" : allowedSections.records ? "records" : allowedSections.history ? "history" : "patients"); }}><span className="avatar purple-av">{initials(patient.full_name)}</span><span><b>{patient.full_name}</b><small>{patient.preferred_name ? "Nome social: " + patient.preferred_name : "Cadastro ativo"}</small></span></button>
        <span className="patient-contact">{patient.phone}<small>{patient.email}</small></span><span className="patient-date">{formatDate(patient.created_at)}</span>
        <span className="patient-actions"><button onClick={() => setEditing({ ...patient })}>Editar</button><button className="danger" onClick={() => deletePatient(patient)}>Excluir</button></span>
      </article>)}</div>
      {!filtered.length && <div className="empty-state"><b>⌕</b><p>Nenhum paciente encontrado.</p><small>Altere a busca ou crie um novo cadastro.</small></div>}
    </div>}
    {section !== "patients" && <PatientProfile patient={selected} section={section} anamnesis={anamnesis} setAnamnesis={setAnamnesis} saveAnamnesis={saveAnamnesis} records={records} noteTitle={noteTitle} setNoteTitle={setNoteTitle} noteContent={noteContent} setNoteContent={setNoteContent} addRecord={addRecord} history={history} />}
    {editing && <PatientEditModal patient={editing} close={() => setEditing(null)} setPatient={setEditing} save={savePatient} />}
  </section>;
}

function PatientProfile({ patient, section, anamnesis, setAnamnesis, saveAnamnesis, records, noteTitle, setNoteTitle, noteContent, setNoteContent, addRecord, history }: { patient: Patient | null; section: "anamnesis" | "records" | "history"; anamnesis: Anamnesis; setAnamnesis: (value: Anamnesis) => void; saveAnamnesis: (event: FormEvent) => void; records: Record[]; noteTitle: string; setNoteTitle: (value: string) => void; noteContent: string; setNoteContent: (value: string) => void; addRecord: (event: FormEvent) => void; history: { starts_at: string; status: string }[] }) {
  if (!patient) return <div className="patient-profile-empty"><span>↗</span><h3>Selecione um paciente</h3><p>Abra um cadastro na aba Pacientes para acessar sua ficha clínica.</p></div>;
  const setField = (field: keyof Anamnesis, value: string) => setAnamnesis({ ...anamnesis, [field]: value });
  return <div className="patient-profile"><header><span className="avatar purple-av">{initials(patient.full_name)}</span><div><p>Paciente selecionado</p><h2>{patient.full_name}</h2><small>{patient.phone || "Sem telefone"} · {patient.email || "Sem e-mail"}</small></div></header>
    {section === "anamnesis" && <form className="clinical-form" onSubmit={saveAnamnesis}><div className="clinical-form-head"><div><h3>Ficha de anamnese</h3><p>Registre informações relevantes para o atendimento.</p></div><button className="new-button">Salvar ficha</button></div><div className="clinical-grid"><Field label="Queixa principal" value={anamnesis.main_complaint} onChange={(value) => setField("main_complaint", value)} /><Field label="Alergias" value={anamnesis.allergies} onChange={(value) => setField("allergies", value)} /><Field label="Medicamentos em uso" value={anamnesis.current_medications} onChange={(value) => setField("current_medications", value)} /><Field label="Condições de saúde" value={anamnesis.medical_conditions} onChange={(value) => setField("medical_conditions", value)} /><Field label="Cirurgias anteriores" value={anamnesis.previous_surgeries} onChange={(value) => setField("previous_surgeries", value)} /><Field label="Histórico familiar" value={anamnesis.family_history} onChange={(value) => setField("family_history", value)} /><Field label="Hábitos e estilo de vida" value={anamnesis.lifestyle_notes} onChange={(value) => setField("lifestyle_notes", value)} /><Field label="Observações clínicas" value={anamnesis.clinical_observations} onChange={(value) => setField("clinical_observations", value)} /></div></form>}
    {section === "records" && <div className="records-area"><form className="record-form" onSubmit={addRecord}><div><h3>Nova evolução</h3><p>Adicione uma observação ao prontuário.</p></div><label>Título<input value={noteTitle} onChange={(event) => setNoteTitle(event.target.value)} /></label><label>Descrição<textarea required value={noteContent} onChange={(event) => setNoteContent(event.target.value)} placeholder="Descreva a evolução, conduta ou orientação realizada." /></label><button className="new-button">Adicionar ao prontuário</button></form><div className="records-list"><h3>Evoluções anteriores</h3>{records.length ? records.map((record) => <article key={record.id}><b>{record.title}</b><time>{formatDate(record.occurred_at)}</time><p>{record.content}</p></article>) : <p className="soft-empty">Nenhuma evolução registrada.</p>}</div></div>}
    {section === "history" && <div className="history-list"><h3>Histórico de atendimentos</h3>{history.length ? history.map((item, index) => <article key={index}><span>{formatDate(item.starts_at)}</span><b>{appointmentHistoryLabels[item.status] || "Agendamento atualizado"}</b></article>) : <p className="soft-empty">Ainda não há atendimentos neste histórico.</p>}</div>}
  </div>;
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <label>{label}<textarea value={value} onChange={(event) => onChange(event.target.value)} /></label>; }
function PatientEditModal({ patient, close, setPatient, save }: { patient: Patient; close: () => void; setPatient: (patient: Patient) => void; save: (event: FormEvent) => void }) { const update = (field: keyof Patient, value: string) => setPatient({ ...patient, [field]: value }); const input = (label: string, field: keyof Patient, type = "text") => <label>{label}<input type={type} value={String(patient[field] || "")} onChange={(event) => update(field, event.target.value)} /></label>; return <div className="modal-backdrop"><form className="modal patient-edit-form patient-edit-complete" onSubmit={save}><button type="button" className="close" onClick={close}>×</button><h2>Editar paciente</h2><p>Atualize todos os dados cadastrais e de contato.</p><label>Nome completo<input required value={patient.full_name} onChange={(event) => update("full_name", event.target.value)} /></label><div className="form-grid">{input("Nome social", "preferred_name")}{input("Telefone", "phone", "tel")}{input("E-mail", "email", "email")}{input("Data de nascimento", "birth_date", "date")}{input("CPF", "cpf")}{input("Gênero", "gender")}{input("Profissão", "occupation")}{input("CEP", "postal_code")}{input("Endereço", "address")}{input("Número", "address_number")}{input("Complemento", "address_complement")}{input("Bairro", "neighborhood")}{input("Cidade", "city")}{input("UF", "state")}{input("Contato de emergência", "emergency_contact_name")}{input("Telefone de emergência", "emergency_contact_phone", "tel")}{input("Indicado por", "referred_by")}</div><label>Observações<textarea value={patient.notes || ""} onChange={(event) => update("notes", event.target.value)} /></label><button className="button">Salvar alterações <span>→</span></button></form></div>; }
