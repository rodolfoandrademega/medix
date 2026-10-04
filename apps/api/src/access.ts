import { database } from "./supabase.js";

export type ClinicAccess = {
  clinicId: string;
  role: string;
  permissions: Record<string, boolean>;
  clinic: Record<string, unknown>;
  member: Record<string, unknown>;
};

export async function getClinicAccess(userId: string, allowInactive = false): Promise<ClinicAccess> {
  const { data, error } = await database
    .from("clinic_members")
    .select("clinic_id,role,permissions,admin_alert_title,admin_alert_message,admin_alert_level,clinics!inner(*)")
    .eq("user_id", userId)
    .order("clinic_id")
    .limit(1)
    .maybeSingle();
  if (error) throw error;
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

export function requirePermission(access: ClinicAccess, permission: string) {
  if (access.role === "owner") return;
  if (access.permissions[permission] !== true) throw Object.assign(new Error("Você não tem permissão para esta operação."), { statusCode: 403 });
}

export async function requirePlatformAdmin(userId: string) {
  const { data, error } = await database.from("platform_admins").select("user_id").eq("user_id", userId).maybeSingle();
  if (error) throw error;
  if (!data) throw Object.assign(new Error("Acesso exclusivo da administração da plataforma."), { statusCode: 403 });
}
