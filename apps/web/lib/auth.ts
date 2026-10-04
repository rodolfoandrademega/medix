import { supabase } from "./supabase";

export async function signIn(email: string, password: string) {
  if (!supabase) throw new Error("A autenticação ainda não foi configurada.");
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

export async function signUp(fullName: string, email: string, password: string) {
  if (!supabase) throw new Error("A autenticação ainda não foi configurada.");
  const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: fullName }, emailRedirectTo: `${window.location.origin}/onboarding` } });
  if (error) throw error;
  if (!data.session) throw new Error("A confirmação de e-mail ainda está ativa no Supabase.");
}

export async function signOut() {
  await supabase?.auth.signOut();
}

export async function resetPassword(email: string) {
  if (!supabase) throw new Error("A autenticação ainda não foi configurada.");
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/auth` });
  if (error) throw error;
}

export async function updatePassword(password: string) {
  if (!supabase) throw new Error("A autenticação ainda não foi configurada.");
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw error;
}
