import { supabase } from "./supabase";

export async function rememberClinic(clinicId: string) {
  const { data } = await supabase?.auth.getSession() || { data: { session: null } };
  if (data.session) window.localStorage.setItem(`medix-clinic:${data.session.user.id}`, clinicId);
}
