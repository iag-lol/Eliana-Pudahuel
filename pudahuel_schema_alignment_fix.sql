-- ========================================
-- PUDAHUEL SCHEMA ALIGNMENT FIX (APP COMPAT)
-- Objetivo: alinear la BD al esquema esperado por la web actual
-- sin perder datos existentes.
-- ========================================

BEGIN;

-- --------------------------------------------------
-- 1) CLIENTES: columnas esperadas por frontend
-- --------------------------------------------------
ALTER TABLE IF EXISTS public.pudahuel_clients
  ADD COLUMN IF NOT EXISTS authorized BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "limit" INTEGER,
  ADD COLUMN IF NOT EXISTS payment_schedule TEXT;

-- Backfill de limite desde credit_limit cuando exista
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'pudahuel_clients' AND column_name = 'credit_limit'
  ) THEN
    EXECUTE '
      UPDATE public.pudahuel_clients
      SET "limit" = COALESCE("limit", credit_limit, 0)
      WHERE "limit" IS NULL
    ';
  END IF;
END
$$;

UPDATE public.pudahuel_clients
SET "limit" = 0
WHERE "limit" IS NULL;

ALTER TABLE public.pudahuel_clients
  ALTER COLUMN "limit" SET DEFAULT 0,
  ALTER COLUMN "limit" SET NOT NULL;

-- --------------------------------------------------
-- 2) TURNOS: columnas esperadas por frontend
-- --------------------------------------------------
ALTER TABLE IF EXISTS public.pudahuel_shifts
  ADD COLUMN IF NOT EXISTS start_time TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS end_time TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS status TEXT,
  ADD COLUMN IF NOT EXISTS initial_cash INTEGER,
  ADD COLUMN IF NOT EXISTS cash_expected INTEGER,
  ADD COLUMN IF NOT EXISTS cash_counted INTEGER,
  ADD COLUMN IF NOT EXISTS difference INTEGER,
  ADD COLUMN IF NOT EXISTS tickets INTEGER,
  ADD COLUMN IF NOT EXISTS payments_breakdown JSONB,
  ADD COLUMN IF NOT EXISTS total_expenses INTEGER;

-- Backfill desde esquema antiguo
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='pudahuel_shifts' AND column_name='opened_at'
  ) THEN
    EXECUTE 'UPDATE public.pudahuel_shifts SET start_time = COALESCE(start_time, opened_at, created_at, NOW())';
  ELSE
    EXECUTE 'UPDATE public.pudahuel_shifts SET start_time = COALESCE(start_time, created_at, NOW())';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='pudahuel_shifts' AND column_name='closed_at'
  ) THEN
    EXECUTE 'UPDATE public.pudahuel_shifts SET end_time = COALESCE(end_time, closed_at)';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='pudahuel_shifts' AND column_name='is_open'
  ) THEN
    EXECUTE '
      UPDATE public.pudahuel_shifts
      SET status = COALESCE(status, CASE WHEN is_open THEN ''open'' ELSE ''closed'' END)
    ';
  ELSE
    EXECUTE '
      UPDATE public.pudahuel_shifts
      SET status = COALESCE(status, CASE WHEN end_time IS NULL THEN ''open'' ELSE ''closed'' END)
    ';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='pudahuel_shifts' AND column_name='cash_initial'
  ) THEN
    EXECUTE 'UPDATE public.pudahuel_shifts SET initial_cash = COALESCE(initial_cash, cash_initial, 0)';
  ELSE
    EXECUTE 'UPDATE public.pudahuel_shifts SET initial_cash = COALESCE(initial_cash, 0)';
  END IF;
END
$$;

UPDATE public.pudahuel_shifts
SET cash_counted = COALESCE(cash_counted, 0),
    total_expenses = COALESCE(total_expenses, 0);

ALTER TABLE public.pudahuel_shifts
  ALTER COLUMN start_time SET DEFAULT NOW(),
  ALTER COLUMN start_time SET NOT NULL,
  ALTER COLUMN status SET DEFAULT 'open',
  ALTER COLUMN status SET NOT NULL,
  ALTER COLUMN initial_cash SET DEFAULT 0,
  ALTER COLUMN initial_cash SET NOT NULL,
  ALTER COLUMN cash_counted SET DEFAULT 0,
  ALTER COLUMN total_expenses SET DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_pudahuel_shifts_start_time ON public.pudahuel_shifts(start_time DESC);
CREATE INDEX IF NOT EXISTS idx_pudahuel_shifts_status ON public.pudahuel_shifts(status);

-- --------------------------------------------------
-- 3) VENTAS: columnas esperadas por frontend
-- --------------------------------------------------
ALTER TABLE IF EXISTS public.pudahuel_sales
  ADD COLUMN IF NOT EXISTS ticket TEXT,
  ADD COLUMN IF NOT EXISTS type TEXT,
  ADD COLUMN IF NOT EXISTS seller TEXT,
  ADD COLUMN IF NOT EXISTS cash_received INTEGER,
  ADD COLUMN IF NOT EXISTS change_amount INTEGER,
  ADD COLUMN IF NOT EXISTS notes JSONB;

UPDATE public.pudahuel_sales
SET type = COALESCE(type, 'sale')
WHERE type IS NULL;

ALTER TABLE public.pudahuel_sales
  ALTER COLUMN type SET DEFAULT 'sale',
  ALTER COLUMN type SET NOT NULL,
  ALTER COLUMN payment_method SET DEFAULT 'cash';

CREATE INDEX IF NOT EXISTS idx_pudahuel_sales_created_at ON public.pudahuel_sales(created_at DESC);

-- --------------------------------------------------
-- 4) MOVIMIENTOS CLIENTE: compatibilidad de tipos/columnas
-- --------------------------------------------------
ALTER TABLE IF EXISTS public.pudahuel_client_movements
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS balance_after INTEGER;

DO $$
DECLARE
  c RECORD;
BEGIN
  IF to_regclass('public.pudahuel_client_movements') IS NOT NULL THEN
    FOR c IN
      SELECT conname
      FROM pg_constraint
      WHERE conrelid = 'public.pudahuel_client_movements'::regclass
        AND contype = 'c'
        AND pg_get_constraintdef(oid) ILIKE '%type%'
    LOOP
      EXECUTE format('ALTER TABLE public.pudahuel_client_movements DROP CONSTRAINT %I', c.conname);
    END LOOP;

    ALTER TABLE public.pudahuel_client_movements
      ADD CONSTRAINT pudahuel_client_movements_type_check
      CHECK (type IN ('cargo','pago','fiado','abono','pago-total'));
  END IF;
END
$$;

UPDATE public.pudahuel_client_movements
SET description = COALESCE(description, notes)
WHERE description IS NULL;

-- --------------------------------------------------
-- 5) GASTOS DE TURNO: crear/alinear tabla
-- --------------------------------------------------
CREATE TABLE IF NOT EXISTS public.pudahuel_shift_expenses (
  id BIGSERIAL PRIMARY KEY,
  shift_id BIGINT NOT NULL REFERENCES public.pudahuel_shifts(id) ON DELETE CASCADE,
  expense_type TEXT NOT NULL,
  amount INTEGER NOT NULL,
  supplier_name TEXT,
  description TEXT,
  paid_from_cash BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.pudahuel_shift_expenses
  ADD COLUMN IF NOT EXISTS paid_from_cash BOOLEAN NOT NULL DEFAULT true;

DO $$
DECLARE
  c RECORD;
BEGIN
  IF to_regclass('public.pudahuel_shift_expenses') IS NOT NULL THEN
    FOR c IN
      SELECT conname
      FROM pg_constraint
      WHERE conrelid = 'public.pudahuel_shift_expenses'::regclass
        AND contype = 'c'
        AND pg_get_constraintdef(oid) ILIKE '%expense_type%'
    LOOP
      EXECUTE format('ALTER TABLE public.pudahuel_shift_expenses DROP CONSTRAINT %I', c.conname);
    END LOOP;

    ALTER TABLE public.pudahuel_shift_expenses
      ADD CONSTRAINT pudahuel_shift_expenses_type_check
      CHECK (expense_type IN ('sueldo','flete','proveedor','otro','operacion'));
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_pudahuel_shift_expenses_shift_id ON public.pudahuel_shift_expenses(shift_id);
CREATE INDEX IF NOT EXISTS idx_pudahuel_shift_expenses_created_at ON public.pudahuel_shift_expenses(created_at DESC);

-- --------------------------------------------------
-- 6) SOLICITUDES DE STOCK: crear tabla si falta
-- --------------------------------------------------
CREATE TABLE IF NOT EXISTS public.pudahuel_stock_requests (
  id BIGSERIAL PRIMARY KEY,
  product_id BIGINT NOT NULL REFERENCES public.pudahuel_products(id) ON DELETE CASCADE,
  product_name TEXT NOT NULL,
  requested_qty INTEGER NOT NULL CHECK (requested_qty > 0),
  final_qty INTEGER NOT NULL CHECK (final_qty > 0),
  requested_by TEXT DEFAULT 'Caja',
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pudahuel_stock_requests_requested_at ON public.pudahuel_stock_requests(requested_at DESC);
CREATE INDEX IF NOT EXISTS idx_pudahuel_stock_requests_product_id ON public.pudahuel_stock_requests(product_id);

-- updated_at trigger utilitario
CREATE OR REPLACE FUNCTION public.pudahuel_update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS pudahuel_products_updated_at ON public.pudahuel_products;
CREATE TRIGGER pudahuel_products_updated_at
  BEFORE UPDATE ON public.pudahuel_products
  FOR EACH ROW
  EXECUTE FUNCTION public.pudahuel_update_updated_at_column();

DROP TRIGGER IF EXISTS pudahuel_clients_updated_at ON public.pudahuel_clients;
CREATE TRIGGER pudahuel_clients_updated_at
  BEFORE UPDATE ON public.pudahuel_clients
  FOR EACH ROW
  EXECUTE FUNCTION public.pudahuel_update_updated_at_column();

DROP TRIGGER IF EXISTS pudahuel_stock_requests_updated_at ON public.pudahuel_stock_requests;
CREATE TRIGGER pudahuel_stock_requests_updated_at
  BEFORE UPDATE ON public.pudahuel_stock_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.pudahuel_update_updated_at_column();

-- --------------------------------------------------
-- 7) RPC batch stock (si no existe)
-- --------------------------------------------------
CREATE OR REPLACE FUNCTION public.pudahuel_apply_stock_adjustments(adjustments jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF adjustments IS NULL OR jsonb_typeof(adjustments) <> 'array' THEN
    RAISE EXCEPTION 'El parámetro adjustments debe ser un arreglo JSON';
  END IF;

  WITH parsed AS (
    SELECT
      (item->>'product_id')::bigint AS product_id,
      (item->>'delta_qty')::integer AS delta_qty
    FROM jsonb_array_elements(adjustments) item
  ),
  aggregated AS (
    SELECT product_id, COALESCE(SUM(delta_qty), 0)::integer AS delta_qty
    FROM parsed
    GROUP BY product_id
  )
  UPDATE public.pudahuel_products p
  SET stock = GREATEST(0, p.stock + aggregated.delta_qty),
      updated_at = NOW()
  FROM aggregated
  WHERE p.id = aggregated.product_id;
END;
$$;

-- --------------------------------------------------
-- 8) RLS + POLICIES POS (SIN LOGIN)
-- --------------------------------------------------
GRANT USAGE ON SCHEMA public TO anon, authenticated;

ALTER TABLE public.pudahuel_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pudahuel_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pudahuel_shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pudahuel_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pudahuel_client_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pudahuel_shift_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pudahuel_stock_requests ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  p RECORD;
BEGIN
  FOR p IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN (
        'pudahuel_products','pudahuel_clients','pudahuel_shifts','pudahuel_sales',
        'pudahuel_client_movements','pudahuel_shift_expenses','pudahuel_stock_requests'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', p.policyname, p.schemaname, p.tablename);
  END LOOP;
END
$$;

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

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pudahuel_products TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pudahuel_clients TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pudahuel_shifts TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pudahuel_sales TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pudahuel_client_movements TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pudahuel_shift_expenses TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pudahuel_stock_requests TO anon, authenticated;
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pudahuel_apply_stock_adjustments(jsonb) TO anon, authenticated;

COMMIT;

-- ------------------------------------------
-- Verificación rápida
-- ------------------------------------------
-- SELECT 'pudahuel_products' table_name, count(*) FROM public.pudahuel_products
-- UNION ALL SELECT 'pudahuel_clients', count(*) FROM public.pudahuel_clients
-- UNION ALL SELECT 'pudahuel_shifts', count(*) FROM public.pudahuel_shifts
-- UNION ALL SELECT 'pudahuel_sales', count(*) FROM public.pudahuel_sales
-- UNION ALL SELECT 'pudahuel_client_movements', count(*) FROM public.pudahuel_client_movements
-- UNION ALL SELECT 'pudahuel_shift_expenses', count(*) FROM public.pudahuel_shift_expenses
-- UNION ALL SELECT 'pudahuel_stock_requests', count(*) FROM public.pudahuel_stock_requests;
