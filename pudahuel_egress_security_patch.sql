-- ========================================
-- SECURITY + EGRESS HARDENING PATCH
-- Ejecutar en Supabase SQL Editor (una vez)
-- ========================================

-- 1) Endurecer RLS para tablas sensibles
ALTER TABLE IF EXISTS public.pudahuel_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.pudahuel_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.pudahuel_shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.pudahuel_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.pudahuel_client_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.pudahuel_shift_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.pudahuel_stock_requests ENABLE ROW LEVEL SECURITY;

-- 2) Eliminar policies públicas/inseguras existentes
DROP POLICY IF EXISTS "Permitir lectura pública de productos" ON public.pudahuel_products;
DROP POLICY IF EXISTS "Permitir inserción de productos" ON public.pudahuel_products;
DROP POLICY IF EXISTS "Permitir actualización de productos" ON public.pudahuel_products;
DROP POLICY IF EXISTS "Permitir eliminación de productos" ON public.pudahuel_products;
DROP POLICY IF EXISTS "Permitir lectura autenticada de productos" ON public.pudahuel_products;
DROP POLICY IF EXISTS "Permitir inserción autenticada de productos" ON public.pudahuel_products;
DROP POLICY IF EXISTS "Permitir actualización autenticada de productos" ON public.pudahuel_products;
DROP POLICY IF EXISTS "Permitir eliminación autenticada de productos" ON public.pudahuel_products;

DROP POLICY IF EXISTS "Permitir lectura pública de clientes" ON public.pudahuel_clients;
DROP POLICY IF EXISTS "Permitir inserción de clientes" ON public.pudahuel_clients;
DROP POLICY IF EXISTS "Permitir actualización de clientes" ON public.pudahuel_clients;
DROP POLICY IF EXISTS "Permitir eliminación de clientes" ON public.pudahuel_clients;
DROP POLICY IF EXISTS "Permitir lectura autenticada de clientes" ON public.pudahuel_clients;
DROP POLICY IF EXISTS "Permitir inserción autenticada de clientes" ON public.pudahuel_clients;
DROP POLICY IF EXISTS "Permitir actualización autenticada de clientes" ON public.pudahuel_clients;
DROP POLICY IF EXISTS "Permitir eliminación autenticada de clientes" ON public.pudahuel_clients;

DROP POLICY IF EXISTS "Permitir lectura pública de turnos" ON public.pudahuel_shifts;
DROP POLICY IF EXISTS "Permitir inserción de turnos" ON public.pudahuel_shifts;
DROP POLICY IF EXISTS "Permitir actualización de turnos" ON public.pudahuel_shifts;
DROP POLICY IF EXISTS "Permitir eliminación de turnos" ON public.pudahuel_shifts;
DROP POLICY IF EXISTS "Permitir lectura autenticada de turnos" ON public.pudahuel_shifts;
DROP POLICY IF EXISTS "Permitir inserción autenticada de turnos" ON public.pudahuel_shifts;
DROP POLICY IF EXISTS "Permitir actualización autenticada de turnos" ON public.pudahuel_shifts;
DROP POLICY IF EXISTS "Permitir eliminación autenticada de turnos" ON public.pudahuel_shifts;

DROP POLICY IF EXISTS "Permitir lectura pública de ventas" ON public.pudahuel_sales;
DROP POLICY IF EXISTS "Permitir inserción de ventas" ON public.pudahuel_sales;
DROP POLICY IF EXISTS "Permitir actualización de ventas" ON public.pudahuel_sales;
DROP POLICY IF EXISTS "Permitir eliminación de ventas" ON public.pudahuel_sales;
DROP POLICY IF EXISTS "Permitir lectura autenticada de ventas" ON public.pudahuel_sales;
DROP POLICY IF EXISTS "Permitir inserción autenticada de ventas" ON public.pudahuel_sales;
DROP POLICY IF EXISTS "Permitir actualización autenticada de ventas" ON public.pudahuel_sales;
DROP POLICY IF EXISTS "Permitir eliminación autenticada de ventas" ON public.pudahuel_sales;

DROP POLICY IF EXISTS "Permitir lectura pública de movimientos" ON public.pudahuel_client_movements;
DROP POLICY IF EXISTS "Permitir inserción de movimientos" ON public.pudahuel_client_movements;
DROP POLICY IF EXISTS "Permitir actualización de movimientos" ON public.pudahuel_client_movements;
DROP POLICY IF EXISTS "Permitir eliminación de movimientos" ON public.pudahuel_client_movements;
DROP POLICY IF EXISTS "Permitir lectura autenticada de movimientos" ON public.pudahuel_client_movements;
DROP POLICY IF EXISTS "Permitir inserción autenticada de movimientos" ON public.pudahuel_client_movements;
DROP POLICY IF EXISTS "Permitir actualización autenticada de movimientos" ON public.pudahuel_client_movements;
DROP POLICY IF EXISTS "Permitir eliminación autenticada de movimientos" ON public.pudahuel_client_movements;

DROP POLICY IF EXISTS "Permitir lectura de gastos" ON public.pudahuel_shift_expenses;
DROP POLICY IF EXISTS "Permitir inserción de gastos" ON public.pudahuel_shift_expenses;
DROP POLICY IF EXISTS "Permitir actualización de gastos" ON public.pudahuel_shift_expenses;
DROP POLICY IF EXISTS "Permitir eliminación de gastos" ON public.pudahuel_shift_expenses;
DROP POLICY IF EXISTS "Permitir lectura autenticada de gastos" ON public.pudahuel_shift_expenses;
DROP POLICY IF EXISTS "Permitir inserción autenticada de gastos" ON public.pudahuel_shift_expenses;
DROP POLICY IF EXISTS "Permitir actualización autenticada de gastos" ON public.pudahuel_shift_expenses;
DROP POLICY IF EXISTS "Permitir eliminación autenticada de gastos" ON public.pudahuel_shift_expenses;

DROP POLICY IF EXISTS "Permitir lectura pública de solicitudes de stock" ON public.pudahuel_stock_requests;
DROP POLICY IF EXISTS "Permitir inserción de solicitudes de stock" ON public.pudahuel_stock_requests;
DROP POLICY IF EXISTS "Permitir actualización de solicitudes de stock" ON public.pudahuel_stock_requests;
DROP POLICY IF EXISTS "Permitir eliminación de solicitudes de stock" ON public.pudahuel_stock_requests;

-- 3) Crear policies seguras (solo authenticated)
CREATE POLICY "Permitir lectura autenticada de productos"
    ON public.pudahuel_products FOR SELECT TO authenticated
    USING (auth.uid() IS NOT NULL);
CREATE POLICY "Permitir inserción autenticada de productos"
    ON public.pudahuel_products FOR INSERT TO authenticated
    WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Permitir actualización autenticada de productos"
    ON public.pudahuel_products FOR UPDATE TO authenticated
    USING (auth.uid() IS NOT NULL)
    WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Permitir eliminación autenticada de productos"
    ON public.pudahuel_products FOR DELETE TO authenticated
    USING (auth.uid() IS NOT NULL);

CREATE POLICY "Permitir lectura autenticada de clientes"
    ON public.pudahuel_clients FOR SELECT TO authenticated
    USING (auth.uid() IS NOT NULL);
CREATE POLICY "Permitir inserción autenticada de clientes"
    ON public.pudahuel_clients FOR INSERT TO authenticated
    WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Permitir actualización autenticada de clientes"
    ON public.pudahuel_clients FOR UPDATE TO authenticated
    USING (auth.uid() IS NOT NULL)
    WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Permitir eliminación autenticada de clientes"
    ON public.pudahuel_clients FOR DELETE TO authenticated
    USING (auth.uid() IS NOT NULL);

CREATE POLICY "Permitir lectura autenticada de turnos"
    ON public.pudahuel_shifts FOR SELECT TO authenticated
    USING (auth.uid() IS NOT NULL);
CREATE POLICY "Permitir inserción autenticada de turnos"
    ON public.pudahuel_shifts FOR INSERT TO authenticated
    WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Permitir actualización autenticada de turnos"
    ON public.pudahuel_shifts FOR UPDATE TO authenticated
    USING (auth.uid() IS NOT NULL)
    WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Permitir eliminación autenticada de turnos"
    ON public.pudahuel_shifts FOR DELETE TO authenticated
    USING (auth.uid() IS NOT NULL);

CREATE POLICY "Permitir lectura autenticada de ventas"
    ON public.pudahuel_sales FOR SELECT TO authenticated
    USING (auth.uid() IS NOT NULL);
CREATE POLICY "Permitir inserción autenticada de ventas"
    ON public.pudahuel_sales FOR INSERT TO authenticated
    WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Permitir actualización autenticada de ventas"
    ON public.pudahuel_sales FOR UPDATE TO authenticated
    USING (auth.uid() IS NOT NULL)
    WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Permitir eliminación autenticada de ventas"
    ON public.pudahuel_sales FOR DELETE TO authenticated
    USING (auth.uid() IS NOT NULL);

CREATE POLICY "Permitir lectura autenticada de movimientos"
    ON public.pudahuel_client_movements FOR SELECT TO authenticated
    USING (auth.uid() IS NOT NULL);
CREATE POLICY "Permitir inserción autenticada de movimientos"
    ON public.pudahuel_client_movements FOR INSERT TO authenticated
    WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Permitir actualización autenticada de movimientos"
    ON public.pudahuel_client_movements FOR UPDATE TO authenticated
    USING (auth.uid() IS NOT NULL)
    WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Permitir eliminación autenticada de movimientos"
    ON public.pudahuel_client_movements FOR DELETE TO authenticated
    USING (auth.uid() IS NOT NULL);

CREATE POLICY "Permitir lectura autenticada de gastos"
    ON public.pudahuel_shift_expenses FOR SELECT TO authenticated
    USING (auth.uid() IS NOT NULL);
CREATE POLICY "Permitir inserción autenticada de gastos"
    ON public.pudahuel_shift_expenses FOR INSERT TO authenticated
    WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Permitir actualización autenticada de gastos"
    ON public.pudahuel_shift_expenses FOR UPDATE TO authenticated
    USING (auth.uid() IS NOT NULL)
    WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Permitir eliminación autenticada de gastos"
    ON public.pudahuel_shift_expenses FOR DELETE TO authenticated
    USING (auth.uid() IS NOT NULL);

CREATE POLICY "Permitir lectura autenticada de solicitudes de stock"
    ON public.pudahuel_stock_requests FOR SELECT TO authenticated
    USING (auth.uid() IS NOT NULL);
CREATE POLICY "Permitir inserción autenticada de solicitudes de stock"
    ON public.pudahuel_stock_requests FOR INSERT TO authenticated
    WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Permitir actualización autenticada de solicitudes de stock"
    ON public.pudahuel_stock_requests FOR UPDATE TO authenticated
    USING (auth.uid() IS NOT NULL)
    WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Permitir eliminación autenticada de solicitudes de stock"
    ON public.pudahuel_stock_requests FOR DELETE TO authenticated
    USING (auth.uid() IS NOT NULL);

-- 4) RPC batch para ajustar stock en una sola llamada por venta/devolución
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
    SET
        stock = GREATEST(0, p.stock + aggregated.delta_qty),
        updated_at = NOW()
    FROM aggregated
    WHERE p.id = aggregated.product_id;
END;
$$;

REVOKE ALL ON FUNCTION public.pudahuel_apply_stock_adjustments(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pudahuel_apply_stock_adjustments(jsonb) TO authenticated;
