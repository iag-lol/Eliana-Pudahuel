import { createClient } from "@supabase/supabase-js";

const cleanEnv = (value: unknown) => {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
};

const normalizeSupabaseUrl = (value: string) => {
  if (!value) return "";
  try {
    const parsed = new URL(value);
    if (!parsed.protocol.startsWith("http")) return "";
    return parsed.origin;
  } catch {
    return "";
  }
};

const envSupabaseUrl = normalizeSupabaseUrl(cleanEnv(import.meta.env.VITE_SUPABASE_URL));
const envSupabaseAnonKey = cleanEnv(import.meta.env.VITE_SUPABASE_ANON_KEY);

const hasSupabaseConfig = envSupabaseUrl.length > 0 && envSupabaseAnonKey.length > 0;
const looksLikeSupabase = envSupabaseUrl.includes(".supabase.co") || envSupabaseUrl.includes(".supabase.in");
const anonKeyLengthOk = envSupabaseAnonKey.length > 40;

// Fail fast with clear error if env está mal en producción
if (!hasSupabaseConfig || !looksLikeSupabase || !anonKeyLengthOk) {
  const reasons = [];
  if (!hasSupabaseConfig) reasons.push("faltan VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY");
  if (hasSupabaseConfig && !looksLikeSupabase) reasons.push("VITE_SUPABASE_URL no parece un proyecto Supabase");
  if (hasSupabaseConfig && !anonKeyLengthOk) reasons.push("VITE_SUPABASE_ANON_KEY parece incompleta");
  const message = `[Supabase] Configuración inválida: ${reasons.join("; ")}. Revisa variables en Render.`;
  // Log fuerte en consola para producción
  console.error(message, {
    VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
    VITE_SUPABASE_ANON_KEY_present: Boolean(import.meta.env.VITE_SUPABASE_ANON_KEY)
  });
  // Exponer para inspección rápida en ventana
  if (typeof window !== "undefined") {
    (window as any).__SUPABASE_ENV_ERROR__ = message;
  }
}

export const SUPABASE_URL = hasSupabaseConfig ? envSupabaseUrl : "https://invalid.supabase.co";
const SUPABASE_ANON_KEY = hasSupabaseConfig ? envSupabaseAnonKey : "missing-supabase-anon-key";
export const SUPABASE_PROJECT_REF = (() => {
  try {
    return new URL(SUPABASE_URL).hostname.split(".")[0] ?? "unknown";
  } catch {
    return "unknown";
  }
})();

if (!hasSupabaseConfig) {
  console.error("VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY inválidas/vacías en el entorno.");
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
  global: {
    headers: {
      "x-client-info": "negocio-pudahuel-dashboard"
    }
  }
});
