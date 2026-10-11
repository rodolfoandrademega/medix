import { database } from "./supabase.js";
import { requirePlatformAdmin } from "./access.js";

export async function resetClinicOwnerPassword(actor: string, clinicId: string, target: unknown, password: unknown) {
  await requirePlatformAdmin(actor);
  if (typeof target !== "string" || !/^[0-9a-f-]{36}$/i.test(target)) throw Object.assign(new Error("Selecione o proprietário da clínica."), { statusCode: 400 });
  if (typeof password !== "string" || password.length < 12 || password.length > 128 || !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
    throw Object.assign(new Error("Use de 12 a 128 caracteres, com letras maiúsculas, minúsculas e números."), { statusCode: 400 });
  }
  if (actor === target) throw Object.assign(new Error("Altere sua própria senha pela recuperação de acesso."), { statusCode: 403 });
  const { data: member, error } = await database.from("clinic_members").select("user_id").eq("clinic_id", clinicId).eq("user_id", target).eq("role", "owner").maybeSingle();
  if (error) throw error;
  if (!member) throw Object.assign(new Error("Esta conta não é proprietária da clínica selecionada."), { statusCode: 404 });
  const protectedAccount = await database.from("platform_admins").select("user_id").eq("user_id", target).maybeSingle();
  if (protectedAccount.error) throw protectedAccount.error;
  if (protectedAccount.data) throw Object.assign(new Error("Contas de super admin não podem ter a senha alterada por esta tela."), { statusCode: 403 });
  const result = await database.auth.admin.updateUserById(target, { password });
  if (result.error) throw Object.assign(new Error("Não foi possível redefinir a senha. Confira os requisitos de segurança e tente novamente."), { statusCode: 400 });
}
