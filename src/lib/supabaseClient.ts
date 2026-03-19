import { createClient } from "@supabase/supabase-js";

const FALLBACK_URL = "https://wvcplgwemvqhvtstlqmt.supabase.co";
const FALLBACK_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind2Y3BsZ3dlbXZxaHZ0c3RscW10Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAzNjIyMDUsImV4cCI6MjA3NTkzODIwNX0.K1YOv5lRn9fOous3AyG2gPxsQBzqOXRfYHgrCmO5zxk";

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? FALLBACK_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? FALLBACK_ANON_KEY;
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
