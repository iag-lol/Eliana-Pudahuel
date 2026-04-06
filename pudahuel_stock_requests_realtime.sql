-- ========================================
-- SOLICITUDES DE STOCK EN TIEMPO REAL
-- Ejecutar una sola vez en Supabase SQL Editor
-- ========================================

-- Función auxiliar para mantener updated_at
CREATE OR REPLACE FUNCTION pudahuel_update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS public.pudahuel_stock_requests (
    id BIGSERIAL PRIMARY KEY,
    product_id BIGINT NOT NULL REFERENCES public.pudahuel_products(id) ON DELETE CASCADE,
    product_name VARCHAR(255) NOT NULL,
    requested_qty INTEGER NOT NULL CHECK (requested_qty > 0),
    final_qty INTEGER NOT NULL CHECK (final_qty > 0),
    requested_by VARCHAR(255) DEFAULT 'Caja',
    requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pudahuel_stock_requests_requested_at
    ON public.pudahuel_stock_requests(requested_at DESC);

CREATE INDEX IF NOT EXISTS idx_pudahuel_stock_requests_product_id
    ON public.pudahuel_stock_requests(product_id);

DROP TRIGGER IF EXISTS pudahuel_stock_requests_updated_at ON public.pudahuel_stock_requests;
CREATE TRIGGER pudahuel_stock_requests_updated_at
    BEFORE UPDATE ON public.pudahuel_stock_requests
    FOR EACH ROW
    EXECUTE FUNCTION pudahuel_update_updated_at_column();

ALTER TABLE public.pudahuel_stock_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir lectura pública de solicitudes de stock" ON public.pudahuel_stock_requests;
DROP POLICY IF EXISTS "Permitir inserción de solicitudes de stock" ON public.pudahuel_stock_requests;
DROP POLICY IF EXISTS "Permitir actualización de solicitudes de stock" ON public.pudahuel_stock_requests;
DROP POLICY IF EXISTS "Permitir eliminación de solicitudes de stock" ON public.pudahuel_stock_requests;

CREATE POLICY "Permitir lectura pública de solicitudes de stock"
    ON public.pudahuel_stock_requests FOR SELECT TO authenticated
    USING (auth.uid() IS NOT NULL);

CREATE POLICY "Permitir inserción de solicitudes de stock"
    ON public.pudahuel_stock_requests FOR INSERT TO authenticated
    WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Permitir actualización de solicitudes de stock"
    ON public.pudahuel_stock_requests FOR UPDATE TO authenticated
    USING (auth.uid() IS NOT NULL)
    WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Permitir eliminación de solicitudes de stock"
    ON public.pudahuel_stock_requests FOR DELETE TO authenticated
    USING (auth.uid() IS NOT NULL);

-- Asegura que PostgreSQL Changes envíe eventos en tiempo real para esta tabla
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        IF NOT EXISTS (
            SELECT 1
            FROM pg_publication_tables
            WHERE pubname = 'supabase_realtime'
              AND schemaname = 'public'
              AND tablename = 'pudahuel_stock_requests'
        ) THEN
            ALTER PUBLICATION supabase_realtime ADD TABLE public.pudahuel_stock_requests;
        END IF;
    END IF;
END;
$$;
