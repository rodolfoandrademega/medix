import { sendPasswordResetEmail, signInWithEmailAndPassword, signOut as firebaseSignOut } from "@firebase/auth";
import { publicApi } from "./api";
import { firebaseAuth, firebaseConfigured } from "./firebase";
import { supabase } from "./supabase";

export async function signIn(email: string, password: string) {
  if (firebaseConfigured && firebaseAuth) {
    await signInWithEmailAndPassword(firebaseAuth, email, password);
    return;
  }
  if (!supabase) throw new Error("A autenticação ainda não foi configurada.");
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

export async function signUp(fullName: string, email: string, password: string) {
  if (firebaseConfigured && firebaseAuth) {
    await publicApi("/v1/auth/register", { method: "POST", body: JSON.stringify({ fullName, email, password }) });
    await signInWithEmailAndPassword(firebaseAuth, email, password);
    return;
  }
  if (!supabase) throw new Error("A autenticação ainda não foi configurada.");
  const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: fullName }, emailRedirectTo: `${window.location.origin}/onboarding` } });
  if (error) throw error;
  if (!data.session) throw new Error("A confirmação de e-mail ainda está ativa no Supabase.");
}

export async function signOut() {
  if (firebaseAuth?.currentUser) await firebaseSignOut(firebaseAuth);
  await supabase?.auth.signOut();
}

export async function resetPassword(email: string) {
  if (!firebaseAuth) throw new Error("A recuperação por Firebase ainda não foi configurada.");
  await sendPasswordResetEmail(firebaseAuth, email);
}
