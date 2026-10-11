import { database } from "./supabase.js";
import type { ClinicAccess } from "./access.js";

export function requireAgenda(access: ClinicAccess) {
  const modules = access.clinic.enabled_modules as Record<string, boolean> | undefined;
  if (modules?.agenda === false || (access.role !== "owner" && access.permissions.agenda !== true)) {
    throw Object.assign(new Error("Você não tem acesso à agenda desta clínica."), { statusCode: 403 });
  }
}

export async function notificationRecipients(clinicId: string) {
  const { data, error } = await database.from("clinic_members").select("user_id,role,permissions,profiles(full_name)").eq("clinic_id", clinicId);
  if (error) throw error;
  return (data || []).filter(member => member.role === "owner" || member.permissions?.agenda === true).map(member => ({
    id: member.user_id, name: (member.profiles as unknown as { full_name: string } | null)?.full_name || "Colaborador", role: member.role,
  }));
}

export async function validateRecipients(clinicId: string, value: unknown): Promise<string[]> {
  if (!Array.isArray(value) || value.length > 100 || value.some(id => typeof id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))) {
    throw Object.assign(new Error("Selecione destinatários válidos."), { statusCode: 400 });
  }
  const ids = [...new Set(value as string[])];
  if (!ids.length) return [];
  const allowed = await notificationRecipients(clinicId);
  if (ids.some(id => !allowed.some(member => member.id === id))) {
    throw Object.assign(new Error("Os destinatários devem pertencer à clínica e ter acesso à agenda."), { statusCode: 400 });
  }
  return ids;
}

type NoticeAppointment = { id: string; starts_at: string; ends_at: string; created_at: string; status: string; patients: unknown; procedures: unknown };
export function buildAppointmentNotices(rows: NoticeAppointment[], advance: number, now = Date.now()) {
  return rows.filter(row => ["scheduled", "confirmed"].includes(row.status)).flatMap(row => {
    const notices = [];
    const start = Date.parse(row.starts_at), created = Date.parse(row.created_at);
    const detail = { appointment_id: row.id, starts_at: row.starts_at, ends_at: row.ends_at, patient: (row.patients as { full_name?: string } | null)?.full_name || "Paciente", procedure: (row.procedures as { name?: string } | null)?.name || "Atendimento" };
    if (created <= now && created >= now - 7 * 86400000) notices.push({ ...detail, id: `created:${row.id}`, kind: "created", occurred_at: row.created_at });
    if (start > now && start <= now + advance * 60000) notices.push({ ...detail, id: `upcoming:${row.id}:${row.starts_at}`, kind: "upcoming", occurred_at: new Date(start - advance * 60000).toISOString() });
    return notices;
  }).sort((a, b) => b.occurred_at.localeCompare(a.occurred_at));
}
