-- ========================================
-- POS RESTORE TOTAL (SIN LOGIN SUPABASE AUTH)
-- Objetivo: volver a mostrar y editar datos en la web con anon key.
-- ADVERTENCIA: deja tablas expuestas para anon/authenticated.
-- Ejecutar en Supabase SQL Editor en el proyecto correcto.
-- ========================================

BEGIN;

-- 0) Roles base para API publica
GRANT USAGE ON SCHEMA public TO anon, authenticated;

-- 1) Asegurar RLS activo pero NO forzado
ALTER TABLE IF EXISTS public.pudahuel_products NO FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.pudahuel_clients NO FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.pudahuel_shifts NO FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.pudahuel_sales NO FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.pudahuel_client_movements NO FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.pudahuel_shift_expenses NO FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.pudahuel_stock_requests NO FORCE ROW LEVEL SECURITY;

ALTER TABLE IF EXISTS public.pudahuel_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.pudahuel_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.pudahuel_shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.pudahuel_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.pudahuel_client_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.pudahuel_shift_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.pudahuel_stock_requests ENABLE ROW LEVEL SECURITY;

-- 2) Limpiar TODAS las policies existentes en estas tablas
DO $$
DECLARE
  p RECORD;
BEGIN
  FOR p IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN (
        'pudahuel_products',
        'pudahuel_clients',
        'pudahuel_shifts',
        'pudahuel_sales',
        'pudahuel_client_movements',
        'pudahuel_shift_expenses',
        'pudahuel_stock_requests'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', p.policyname, p.schemaname, p.tablename);
  END LOOP;
END
$$;

-- 3) Re-crear policies abiertas para POS sin login
CREATE POLICY pos_products_select ON public.pudahuel_products FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY pos_products_insert ON public.pudahuel_products FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY pos_products_update ON public.pudahuel_products FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY pos_products_delete ON public.pudahuel_products FOR DELETE TO anon, authenticated USING (true);

CREATE POLICY pos_clients_select ON public.pudahuel_clients FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY pos_clients_insert ON public.pudahuel_clients FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY pos_clients_update ON public.pudahuel_clients FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY pos_clients_delete ON public.pudahuel_clients FOR DELETE TO anon, authenticated USING (true);

CREATE POLICY pos_shifts_select ON public.pudahuel_shifts FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY pos_shifts_insert ON public.pudahuel_shifts FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY pos_shifts_update ON public.pudahuel_shifts FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY pos_shifts_delete ON public.pudahuel_shifts FOR DELETE TO anon, authenticated USING (true);

CREATE POLICY pos_sales_select ON public.pudahuel_sales FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY pos_sales_insert ON public.pudahuel_sales FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY pos_sales_update ON public.pudahuel_sales FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY pos_sales_delete ON public.pudahuel_sales FOR DELETE TO anon, authenticated USING (true);

CREATE POLICY pos_mov_select ON public.pudahuel_client_movements FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY pos_mov_insert ON public.pudahuel_client_movements FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY pos_mov_update ON public.pudahuel_client_movements FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY pos_mov_delete ON public.pudahuel_client_movements FOR DELETE TO anon, authenticated USING (true);

CREATE POLICY pos_exp_select ON public.pudahuel_shift_expenses FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY pos_exp_insert ON public.pudahuel_shift_expenses FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY pos_exp_update ON public.pudahuel_shift_expenses FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY pos_exp_delete ON public.pudahuel_shift_expenses FOR DELETE TO anon, authenticated USING (true);

CREATE POLICY pos_stockreq_select ON public.pudahuel_stock_requests FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY pos_stockreq_insert ON public.pudahuel_stock_requests FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY pos_stockreq_update ON public.pudahuel_stock_requests FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY pos_stockreq_delete ON public.pudahuel_stock_requests FOR DELETE TO anon, authenticated USING (true);

-- 4) Permisos de tabla para anon/authenticated (clave si se revocaron)
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.pudahuel_products TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.pudahuel_clients TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.pudahuel_shifts TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.pudahuel_sales TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.pudahuel_client_movements TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.pudahuel_shift_expenses TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.pudahuel_stock_requests TO anon, authenticated;

-- 5) Permisos de secuencias (para INSERT en columnas identity/serial)
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;

-- 6) RPC de stock batch
DO $$
BEGIN
  IF to_regprocedure('public.pudahuel_apply_stock_adjustments(jsonb)') IS NOT NULL THEN
    GRANT EXECUTE ON FUNCTION public.pudahuel_apply_stock_adjustments(jsonb) TO anon, authenticated;
  END IF;
END
$$;

COMMIT;

-- Verificacion rapida (opcional):
-- SELECT tablename, policyname, roles, cmd
-- FROM pg_policies
-- WHERE schemaname = 'public'
--   AND tablename IN (
--     'pudahuel_products','pudahuel_clients','pudahuel_shifts','pudahuel_sales',
--     'pudahuel_client_movements','pudahuel_shift_expenses','pudahuel_stock_requests'
--   )
-- ORDER BY tablename, cmd, policyname;
