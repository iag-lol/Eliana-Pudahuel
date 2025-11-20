-- ========================================
-- SCRIPT SQL COMPLETO PARA PUDAHUEL
-- Base de datos: https://tcmtxvuucjttngcazgff.supabase.co
-- ========================================

-- NOTA: Ejecutar en el SQL Editor de Supabase

-- ========================================
-- 1. TABLA: pudahuel_products (Productos)
-- ========================================
CREATE TABLE IF NOT EXISTS pudahuel_products (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    barcode VARCHAR(100),
    category VARCHAR(100) NOT NULL DEFAULT 'General',
    cost INTEGER NOT NULL DEFAULT 0,
    price INTEGER NOT NULL DEFAULT 0,
    stock INTEGER NOT NULL DEFAULT 0,
    stock_min INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para pudahuel_products
CREATE INDEX IF NOT EXISTS idx_pudahuel_products_name ON pudahuel_products(name);
CREATE INDEX IF NOT EXISTS idx_pudahuel_products_barcode ON pudahuel_products(barcode);
CREATE INDEX IF NOT EXISTS idx_pudahuel_products_category ON pudahuel_products(category);
CREATE INDEX IF NOT EXISTS idx_pudahuel_products_stock_low ON pudahuel_products(stock) WHERE stock <= stock_min;

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION pudahuel_update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER pudahuel_products_updated_at
    BEFORE UPDATE ON pudahuel_products
    FOR EACH ROW
    EXECUTE FUNCTION pudahuel_update_updated_at_column();

-- Comentarios
COMMENT ON TABLE pudahuel_products IS 'Catálogo de productos del negocio Pudahuel';
COMMENT ON COLUMN pudahuel_products.stock_min IS 'Stock mínimo para alertas de reposición';

-- ========================================
-- 2. TABLA: pudahuel_clients (Clientes)
-- ========================================
CREATE TABLE IF NOT EXISTS pudahuel_clients (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    contact VARCHAR(100),
    credit_limit INTEGER NOT NULL DEFAULT 0,
    balance INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para pudahuel_clients
CREATE INDEX IF NOT EXISTS idx_pudahuel_clients_name ON pudahuel_clients(name);
CREATE INDEX IF NOT EXISTS idx_pudahuel_clients_balance ON pudahuel_clients(balance) WHERE balance > 0;

-- Trigger para updated_at
CREATE TRIGGER pudahuel_clients_updated_at
    BEFORE UPDATE ON pudahuel_clients
    FOR EACH ROW
    EXECUTE FUNCTION pudahuel_update_updated_at_column();

-- Comentarios
COMMENT ON TABLE pudahuel_clients IS 'Clientes del negocio Pudahuel con sistema de crédito';
COMMENT ON COLUMN pudahuel_clients.credit_limit IS 'Límite máximo de crédito permitido';
COMMENT ON COLUMN pudahuel_clients.balance IS 'Saldo actual adeudado por el cliente';

-- ========================================
-- 3. TABLA: pudahuel_shifts (Turnos)
-- ========================================
CREATE TABLE IF NOT EXISTS pudahuel_shifts (
    id BIGSERIAL PRIMARY KEY,
    seller VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL DEFAULT 'regular',
    cash_initial INTEGER NOT NULL DEFAULT 0,
    cash_sales INTEGER NOT NULL DEFAULT 0,
    total_sales INTEGER NOT NULL DEFAULT 0,
    is_open BOOLEAN NOT NULL DEFAULT true,
    opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    closed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para pudahuel_shifts
CREATE INDEX IF NOT EXISTS idx_pudahuel_shifts_seller ON pudahuel_shifts(seller);
CREATE INDEX IF NOT EXISTS idx_pudahuel_shifts_is_open ON pudahuel_shifts(is_open) WHERE is_open = true;
CREATE INDEX IF NOT EXISTS idx_pudahuel_shifts_opened_at ON pudahuel_shifts(opened_at DESC);

-- Comentarios
COMMENT ON TABLE pudahuel_shifts IS 'Turnos de trabajo de los vendedores';
COMMENT ON COLUMN pudahuel_shifts.cash_initial IS 'Efectivo inicial del turno';
COMMENT ON COLUMN pudahuel_shifts.cash_sales IS 'Total de ventas en efectivo del turno';
COMMENT ON COLUMN pudahuel_shifts.total_sales IS 'Total de todas las ventas del turno';

-- ========================================
-- 4. TABLA: pudahuel_sales (Ventas)
-- ========================================
CREATE TABLE IF NOT EXISTS pudahuel_sales (
    id BIGSERIAL PRIMARY KEY,
    shift_id BIGINT REFERENCES pudahuel_shifts(id) ON DELETE SET NULL,
    client_id BIGINT REFERENCES pudahuel_clients(id) ON DELETE SET NULL,
    total INTEGER NOT NULL DEFAULT 0,
    payment_method VARCHAR(50) NOT NULL DEFAULT 'Efectivo',
    items JSONB NOT NULL DEFAULT '[]',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para pudahuel_sales
CREATE INDEX IF NOT EXISTS idx_pudahuel_sales_shift_id ON pudahuel_sales(shift_id);
CREATE INDEX IF NOT EXISTS idx_pudahuel_sales_client_id ON pudahuel_sales(client_id);
CREATE INDEX IF NOT EXISTS idx_pudahuel_sales_payment_method ON pudahuel_sales(payment_method);
CREATE INDEX IF NOT EXISTS idx_pudahuel_sales_created_at ON pudahuel_sales(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pudahuel_sales_items ON pudahuel_sales USING GIN (items);

-- Comentarios
COMMENT ON TABLE pudahuel_sales IS 'Registro de ventas del negocio Pudahuel';
COMMENT ON COLUMN pudahuel_sales.items IS 'Array JSON con los productos vendidos: [{product_id, name, quantity, price, total}]';
COMMENT ON COLUMN pudahuel_sales.payment_method IS 'Método de pago: Efectivo, Tarjeta, Transferencia, Fiado, Consumo Personal';

-- ========================================
-- 5. TABLA: pudahuel_client_movements (Movimientos de Crédito)
-- ========================================
CREATE TABLE IF NOT EXISTS pudahuel_client_movements (
    id BIGSERIAL PRIMARY KEY,
    client_id BIGINT NOT NULL REFERENCES pudahuel_clients(id) ON DELETE CASCADE,
    sale_id BIGINT REFERENCES pudahuel_sales(id) ON DELETE SET NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('cargo', 'pago')),
    amount INTEGER NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para pudahuel_client_movements
CREATE INDEX IF NOT EXISTS idx_pudahuel_client_movements_client_id ON pudahuel_client_movements(client_id);
CREATE INDEX IF NOT EXISTS idx_pudahuel_client_movements_sale_id ON pudahuel_client_movements(sale_id);
CREATE INDEX IF NOT EXISTS idx_pudahuel_client_movements_type ON pudahuel_client_movements(type);
CREATE INDEX IF NOT EXISTS idx_pudahuel_client_movements_created_at ON pudahuel_client_movements(created_at DESC);

-- Comentarios
COMMENT ON TABLE pudahuel_client_movements IS 'Movimientos de crédito de los clientes (cargos y pagos)';
COMMENT ON COLUMN pudahuel_client_movements.type IS 'Tipo de movimiento: cargo (aumenta deuda) o pago (reduce deuda)';

-- ========================================
-- POLÍTICAS RLS (Row Level Security)
-- ========================================

-- Habilitar RLS en todas las tablas
ALTER TABLE pudahuel_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE pudahuel_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE pudahuel_shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE pudahuel_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE pudahuel_client_movements ENABLE ROW LEVEL SECURITY;

-- Políticas públicas (permitir todo para anon/authenticated)
-- NOTA: Ajustar según necesidades de seguridad en producción

-- Políticas para pudahuel_products
CREATE POLICY "Permitir lectura pública de productos" ON pudahuel_products
    FOR SELECT USING (true);

CREATE POLICY "Permitir inserción de productos" ON pudahuel_products
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Permitir actualización de productos" ON pudahuel_products
    FOR UPDATE USING (true);

CREATE POLICY "Permitir eliminación de productos" ON pudahuel_products
    FOR DELETE USING (true);

-- Políticas para pudahuel_clients
CREATE POLICY "Permitir lectura pública de clientes" ON pudahuel_clients
    FOR SELECT USING (true);

CREATE POLICY "Permitir inserción de clientes" ON pudahuel_clients
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Permitir actualización de clientes" ON pudahuel_clients
    FOR UPDATE USING (true);

CREATE POLICY "Permitir eliminación de clientes" ON pudahuel_clients
    FOR DELETE USING (true);

-- Políticas para pudahuel_shifts
CREATE POLICY "Permitir lectura pública de turnos" ON pudahuel_shifts
    FOR SELECT USING (true);

CREATE POLICY "Permitir inserción de turnos" ON pudahuel_shifts
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Permitir actualización de turnos" ON pudahuel_shifts
    FOR UPDATE USING (true);

CREATE POLICY "Permitir eliminación de turnos" ON pudahuel_shifts
    FOR DELETE USING (true);

-- Políticas para pudahuel_sales
CREATE POLICY "Permitir lectura pública de ventas" ON pudahuel_sales
    FOR SELECT USING (true);

CREATE POLICY "Permitir inserción de ventas" ON pudahuel_sales
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Permitir actualización de ventas" ON pudahuel_sales
    FOR UPDATE USING (true);

CREATE POLICY "Permitir eliminación de ventas" ON pudahuel_sales
    FOR DELETE USING (true);

-- Políticas para pudahuel_client_movements
CREATE POLICY "Permitir lectura pública de movimientos" ON pudahuel_client_movements
    FOR SELECT USING (true);

CREATE POLICY "Permitir inserción de movimientos" ON pudahuel_client_movements
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Permitir actualización de movimientos" ON pudahuel_client_movements
    FOR UPDATE USING (true);

CREATE POLICY "Permitir eliminación de movimientos" ON pudahuel_client_movements
    FOR DELETE USING (true);

-- ========================================
-- VISTAS ÚTILES
-- ========================================

-- Vista de productos con bajo stock
CREATE OR REPLACE VIEW pudahuel_low_stock_products AS
SELECT
    id,
    name,
    barcode,
    category,
    cost,
    price,
    stock,
    stock_min,
    (stock_min - stock) as deficit,
    ROUND((stock::decimal / NULLIF(stock_min, 0)) * 100, 2) as stock_percentage
FROM pudahuel_products
WHERE stock_min > 0 AND stock <= stock_min
ORDER BY stock ASC, deficit DESC;

COMMENT ON VIEW pudahuel_low_stock_products IS 'Vista de productos que requieren reposición';

-- Vista de resumen de clientes con deuda
CREATE OR REPLACE VIEW pudahuel_clients_with_debt AS
SELECT
    id,
    name,
    contact,
    credit_limit,
    balance,
    (credit_limit - balance) as available_credit,
    ROUND((balance::decimal / NULLIF(credit_limit, 0)) * 100, 2) as debt_percentage,
    created_at
FROM pudahuel_clients
WHERE balance > 0
ORDER BY balance DESC;

COMMENT ON VIEW pudahuel_clients_with_debt IS 'Vista de clientes con saldo pendiente';

-- Vista de turnos activos
CREATE OR REPLACE VIEW pudahuel_active_shifts AS
SELECT
    id,
    seller,
    type,
    cash_initial,
    cash_sales,
    total_sales,
    (total_sales - cash_sales) as other_sales,
    opened_at,
    EXTRACT(EPOCH FROM (NOW() - opened_at))/3600 as hours_open
FROM pudahuel_shifts
WHERE is_open = true
ORDER BY opened_at DESC;

COMMENT ON VIEW pudahuel_active_shifts IS 'Vista de turnos actualmente abiertos';

-- ========================================
-- FUNCIONES ÚTILES
-- ========================================

-- Función para actualizar el balance de un cliente
CREATE OR REPLACE FUNCTION pudahuel_update_client_balance(
    p_client_id BIGINT,
    p_amount INTEGER,
    p_type VARCHAR
)
RETURNS VOID AS $$
BEGIN
    IF p_type = 'cargo' THEN
        UPDATE pudahuel_clients
        SET balance = balance + p_amount
        WHERE id = p_client_id;
    ELSIF p_type = 'pago' THEN
        UPDATE pudahuel_clients
        SET balance = GREATEST(balance - p_amount, 0)
        WHERE id = p_client_id;
    END IF;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION pudahuel_update_client_balance IS 'Actualiza el saldo de un cliente según el tipo de movimiento';

-- ========================================
-- DATOS DE EJEMPLO (OPCIONAL)
-- ========================================

-- Insertar productos de ejemplo
INSERT INTO pudahuel_products (name, barcode, category, cost, price, stock, stock_min) VALUES
('Coca Cola 500ml', '7501234567890', 'Bebidas', 800, 1200, 24, 10),
('Pan Hallulla', '7501234567891', 'Panadería', 300, 500, 15, 20),
('Leche Entera 1L', '7501234567892', 'Lácteos', 900, 1300, 8, 12),
('Café Nescafé 170g', '7501234567893', 'Despensa', 3500, 5000, 5, 8),
('Arroz 1kg', '7501234567894', 'Abarrotes', 1200, 1800, 30, 15)
ON CONFLICT DO NOTHING;

-- Insertar clientes de ejemplo
INSERT INTO pudahuel_clients (name, contact, credit_limit, balance) VALUES
('Juan Pérez', '+56912345678', 50000, 0),
('María González', '+56987654321', 30000, 5000),
('Pedro Soto', '+56911223344', 40000, 15000)
ON CONFLICT DO NOTHING;

-- ========================================
-- INFORMACIÓN DE CONEXIÓN
-- ========================================

/*
URL de Supabase: https://tcmtxvuucjttngcazgff.supabase.co
API Key (Anon): eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRjbXR4dnV1Y2p0dG5nY2F6Z2ZmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDA3MjUwMDEsImV4cCI6MjA1NjMwMTAwMX0.2WcIjMUEhSM6j9kYpbsYArQocZdHx86k7wXk-NyjIs0

TABLAS CREADAS:
1. pudahuel_products - Productos del inventario
2. pudahuel_clients - Clientes con sistema de crédito
3. pudahuel_shifts - Turnos de trabajo
4. pudahuel_sales - Registro de ventas
5. pudahuel_client_movements - Movimientos de crédito

VISTAS CREADAS:
1. pudahuel_low_stock_products - Productos con stock bajo
2. pudahuel_clients_with_debt - Clientes con deuda
3. pudahuel_active_shifts - Turnos activos

FUNCIONES CREADAS:
1. pudahuel_update_client_balance - Actualizar balance de cliente
2. pudahuel_update_updated_at_column - Trigger para updated_at
*/

-- ========================================
-- FIN DEL SCRIPT
-- ========================================
