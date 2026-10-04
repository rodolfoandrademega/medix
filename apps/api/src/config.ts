function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Variável obrigatória ausente: ${name}`);
  return value;
}

export const config = {
  port: Number(process.env.PORT || 8080),
  allowedOrigin: process.env.ALLOWED_ORIGIN || "http://localhost:3000",
  firebaseProjectId: required("FIREBASE_PROJECT_ID"),
  authProvider: process.env.AUTH_PROVIDER === "firebase" ? "firebase" : "supabase",
  supabaseUrl: required("SUPABASE_URL"),
  supabaseServiceRoleKey: required("SUPABASE_SERVICE_ROLE_KEY"),
  resendApiKey: process.env.RESEND_API_KEY,
  emailFrom: process.env.EMAIL_FROM,
};
