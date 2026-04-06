-- ========================================
-- COMPATIBILIDAD POS SIN LOGIN SUPABASE AUTH
-- Permite que el frontend usando anon key pueda leer/escribir
-- ========================================

ALTER TABLE IF EXISTS public.pudahuel_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.pudahuel_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.pudahuel_shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.pudahuel_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.pudahuel_client_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.pudahuel_shift_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.pudahuel_stock_requests ENABLE ROW LEVEL SECURITY;

-- PRODUCTS
DROP POLICY IF EXISTS pos_products_select ON public.pudahuel_products;
DROP POLICY IF EXISTS pos_products_insert ON public.pudahuel_products;
DROP POLICY IF EXISTS pos_products_update ON public.pudahuel_products;
DROP POLICY IF EXISTS pos_products_delete ON public.pudahuel_products;
CREATE POLICY pos_products_select ON public.pudahuel_products FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY pos_products_insert ON public.pudahuel_products FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY pos_products_update ON public.pudahuel_products FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY pos_products_delete ON public.pudahuel_products FOR DELETE TO anon, authenticated USING (true);

-- CLIENTS
DROP POLICY IF EXISTS pos_clients_select ON public.pudahuel_clients;
DROP POLICY IF EXISTS pos_clients_insert ON public.pudahuel_clients;
DROP POLICY IF EXISTS pos_clients_update ON public.pudahuel_clients;
DROP POLICY IF EXISTS pos_clients_delete ON public.pudahuel_clients;
CREATE POLICY pos_clients_select ON public.pudahuel_clients FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY pos_clients_insert ON public.pudahuel_clients FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY pos_clients_update ON public.pudahuel_clients FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY pos_clients_delete ON public.pudahuel_clients FOR DELETE TO anon, authenticated USING (true);

-- SHIFTS
DROP POLICY IF EXISTS pos_shifts_select ON public.pudahuel_shifts;
DROP POLICY IF EXISTS pos_shifts_insert ON public.pudahuel_shifts;
DROP POLICY IF EXISTS pos_shifts_update ON public.pudahuel_shifts;
DROP POLICY IF EXISTS pos_shifts_delete ON public.pudahuel_shifts;
CREATE POLICY pos_shifts_select ON public.pudahuel_shifts FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY pos_shifts_insert ON public.pudahuel_shifts FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY pos_shifts_update ON public.pudahuel_shifts FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY pos_shifts_delete ON public.pudahuel_shifts FOR DELETE TO anon, authenticated USING (true);

-- SALES
DROP POLICY IF EXISTS pos_sales_select ON public.pudahuel_sales;
DROP POLICY IF EXISTS pos_sales_insert ON public.pudahuel_sales;
DROP POLICY IF EXISTS pos_sales_update ON public.pudahuel_sales;
DROP POLICY IF EXISTS pos_sales_delete ON public.pudahuel_sales;
CREATE POLICY pos_sales_select ON public.pudahuel_sales FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY pos_sales_insert ON public.pudahuel_sales FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY pos_sales_update ON public.pudahuel_sales FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY pos_sales_delete ON public.pudahuel_sales FOR DELETE TO anon, authenticated USING (true);

-- CLIENT MOVEMENTS
DROP POLICY IF EXISTS pos_mov_select ON public.pudahuel_client_movements;
DROP POLICY IF EXISTS pos_mov_insert ON public.pudahuel_client_movements;
DROP POLICY IF EXISTS pos_mov_update ON public.pudahuel_client_movements;
DROP POLICY IF EXISTS pos_mov_delete ON public.pudahuel_client_movements;
CREATE POLICY pos_mov_select ON public.pudahuel_client_movements FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY pos_mov_insert ON public.pudahuel_client_movements FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY pos_mov_update ON public.pudahuel_client_movements FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY pos_mov_delete ON public.pudahuel_client_movements FOR DELETE TO anon, authenticated USING (true);

-- SHIFT EXPENSES
DROP POLICY IF EXISTS pos_exp_select ON public.pudahuel_shift_expenses;
DROP POLICY IF EXISTS pos_exp_insert ON public.pudahuel_shift_expenses;
DROP POLICY IF EXISTS pos_exp_update ON public.pudahuel_shift_expenses;
DROP POLICY IF EXISTS pos_exp_delete ON public.pudahuel_shift_expenses;
CREATE POLICY pos_exp_select ON public.pudahuel_shift_expenses FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY pos_exp_insert ON public.pudahuel_shift_expenses FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY pos_exp_update ON public.pudahuel_shift_expenses FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY pos_exp_delete ON public.pudahuel_shift_expenses FOR DELETE TO anon, authenticated USING (true);

-- STOCK REQUESTS
DROP POLICY IF EXISTS pos_stockreq_select ON public.pudahuel_stock_requests;
DROP POLICY IF EXISTS pos_stockreq_insert ON public.pudahuel_stock_requests;
DROP POLICY IF EXISTS pos_stockreq_update ON public.pudahuel_stock_requests;
DROP POLICY IF EXISTS pos_stockreq_delete ON public.pudahuel_stock_requests;
CREATE POLICY pos_stockreq_select ON public.pudahuel_stock_requests FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY pos_stockreq_insert ON public.pudahuel_stock_requests FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY pos_stockreq_update ON public.pudahuel_stock_requests FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY pos_stockreq_delete ON public.pudahuel_stock_requests FOR DELETE TO anon, authenticated USING (true);

-- RPC para batch stock: permitir anon también si el POS no usa login
GRANT EXECUTE ON FUNCTION public.pudahuel_apply_stock_adjustments(jsonb) TO anon, authenticated;
