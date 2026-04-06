import { createClient } from "@supabase/supabase-js";

const FALLBACK_URL = "https://tcmtxvuucjttngcazgff.supabase.co";
const FALLBACK_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRjbXR4dnV1Y2p0dG5nY2F6Z2ZmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDA3MjUwMDEsImV4cCI6MjA1NjMwMTAwMX0.2WcIjMUEhSM6j9kYpbsYArQocZdHx86k7wXk-NyjIs0";

const cleanEnv = (value: unknown) => (typeof value === "string" ? value.trim() : "");
const envSupabaseUrl = cleanEnv(import.meta.env.VITE_SUPABASE_URL);
const envSupabaseAnonKey = cleanEnv(import.meta.env.VITE_SUPABASE_ANON_KEY);

export const SUPABASE_URL = envSupabaseUrl.length > 0 ? envSupabaseUrl : FALLBACK_URL;
const SUPABASE_ANON_KEY = envSupabaseAnonKey.length > 0 ? envSupabaseAnonKey : FALLBACK_ANON_KEY;
export const SUPABASE_PROJECT_REF = (() => {
  try {
    return new URL(SUPABASE_URL).hostname.split(".")[0] ?? "unknown";
  } catch {
    return "unknown";
  }
})();

if (envSupabaseUrl.length === 0 || envSupabaseAnonKey.length === 0) {
  console.warn(
    "Faltan VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY. Se usarán credenciales fallback solo para desarrollo."
  );
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
  global: {
    headers: {
      "x-client-info": "negocio-pudahuel-dashboard"
    }
  }
});
