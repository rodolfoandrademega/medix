import { database } from "./supabase.js";

export type ClinicAccess = {
  clinicId: string;
  role: string;
  permissions: Record<string, boolean>;
  clinic: Record<string, unknown>;
  member: Record<string, unknown>;
};

export async function getClinicAccess(userId: string, allowInactive = false, targetClinic?: unknown): Promise<ClinicAccess> {
  if (targetClinic !== undefined && (typeof targetClinic !== "string" || !/^[0-9a-f-]{36}$/i.test(targetClinic))) {
    throw Object.assign(new Error("Identificador de clínica inválido."), { statusCode: 400 });
  }
  let query = database
    .from("clinic_members")
    .select("clinic_id,role,permissions,admin_alert_title,admin_alert_message,admin_alert_level,clinics!inner(*)")
    .eq("user_id", userId);
  if (typeof targetClinic === "string") query = query.eq("clinic_id", targetClinic);
  const { data: memberships, error } = await query;
  if (error) throw error;
  // Sem seleção explícita, prioriza a clínica recém-criada, inclusive pendente.
  // Nunca troca automaticamente para uma clínica antiga só porque ela está ativa.
  const data = (memberships || []).sort((left, right) => {
    const a = left.clinics as unknown as { created_at: string };
    const b = right.clinics as unknown as { created_at: string };
    return b.created_at.localeCompare(a.created_at) || left.clinic_id.localeCompare(right.clinic_id);
  })[0];
  if (!data && targetClinic) throw Object.assign(new Error("Esta clínica não está vinculada à sua conta."), { statusCode: 403 });
  if (!data) throw Object.assign(new Error("Nenhuma clínica vinculada a este usuário."), { statusCode: 404 });
  const clinic = data.clinics as unknown as Record<string, unknown>;
  if (!allowInactive && clinic.status !== "active") throw Object.assign(new Error("A clínica ainda não está ativa."), { statusCode: 403 });
  return {
    clinicId: data.clinic_id,
    role: data.role,
    permissions: (data.permissions || {}) as Record<string, boolean>,
    clinic,
    member: data as unknown as Record<string, unknown>,
  };
}

export function hasPermission(access: ClinicAccess, permission: string) {
  const module = ["anamnesis", "records", "history"].includes(permission) ? "patients" : permission;
  const modules = access.clinic.enabled_modules as Record<string, boolean> | undefined;
  return modules?.[module] !== false && (access.role === "owner" || access.permissions[permission] === true);
}

export function requirePermission(access: ClinicAccess, permission: string) {
  if (!hasPermission(access, permission)) throw Object.assign(new Error("Você não tem permissão para esta operação."), { statusCode: 403 });
}

export async function requirePlatformAdmin(userId: string) {
  const { data, error } = await database.from("platform_admins").select("user_id").eq("user_id", userId).maybeSingle();
  if (error) throw error;
  if (!data) throw Object.assign(new Error("Acesso exclusivo da administração da plataforma."), { statusCode: 403 });
}
