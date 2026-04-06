import { createClient } from "@supabase/supabase-js";

// Se fuerza la conexión al proyecto proporcionado por el cliente, ignorando variables de entorno.
export const SUPABASE_URL = "https://omvxnodsaiqtvxyrvebt.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9tdnhub2RzYWlxdHZ4eXJ2ZWJ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIwMTkyMzgsImV4cCI6MjA3NzU5NTIzOH0.5QMmyk1GfAU09ng1NW21WmSpZszsVMX34U5fbyrjF_0";
export const SUPABASE_PROJECT_REF = (() => {
  try {
    return new URL(SUPABASE_URL).hostname.split(".")[0] ?? "unknown";
  } catch {
    return "unknown";
  }
})();

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
  global: {
    headers: {
      "x-client-info": "negocio-pudahuel-dashboard"
    }
  }
});
