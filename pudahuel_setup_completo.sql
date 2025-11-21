-- ========================================
-- SCRIPT SQL COMPLETO Y SEGURO PARA PUDAHUEL
-- Se puede ejecutar múltiples veces sin errores
-- ========================================

-- ========================================
-- 1. ELIMINAR TRIGGERS EXISTENTES (si existen)
-- ========================================
DROP TRIGGER IF EXISTS pudahuel_products_updated_at ON pudahuel_products;
DROP TRIGGER IF EXISTS pudahuel_clients_updated_at ON pudahuel_clients;
DROP TRIGGER IF EXISTS trigger_update_shift_expenses_insert ON pudahuel_shift_expenses;
DROP TRIGGER IF EXISTS trigger_update_shift_expenses_update ON pudahuel_shift_expenses;
DROP TRIGGER IF EXISTS trigger_update_shift_expenses_delete ON pudahuel_shift_expenses;

-- ========================================
-- 2. TABLA: pudahuel_products (Productos)
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

-- Función para updated_at
CREATE OR REPLACE FUNCTION pudahuel_update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para updated_at en products
CREATE TRIGGER pudahuel_products_updated_at
    BEFORE UPDATE ON pudahuel_products
    FOR EACH ROW
    EXECUTE FUNCTION pudahuel_update_updated_at_column();

-- ========================================
-- 3. TABLA: pudahuel_clients (Clientes)
-- ========================================
CREATE TABLE IF NOT EXISTS pudahuel_clients (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    contact VARCHAR(100),
    credit_limit INTEGER NOT NULL DEFAULT 0,
    "limit" INTEGER NOT NULL DEFAULT 0,
    authorized BOOLEAN NOT NULL DEFAULT true,
    balance INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para pudahuel_clients
CREATE INDEX IF NOT EXISTS idx_pudahuel_clients_name ON pudahuel_clients(name);
CREATE INDEX IF NOT EXISTS idx_pudahuel_clients_balance ON pudahuel_clients(balance) WHERE balance > 0;
CREATE INDEX IF NOT EXISTS idx_pudahuel_clients_authorized ON pudahuel_clients(authorized);

-- Trigger para updated_at en clients
CREATE TRIGGER pudahuel_clients_updated_at
    BEFORE UPDATE ON pudahuel_clients
    FOR EACH ROW
    EXECUTE FUNCTION pudahuel_update_updated_at_column();

-- ========================================
-- 4. TABLA: pudahuel_shifts (Turnos)
-- ========================================
CREATE TABLE IF NOT EXISTS pudahuel_shifts (
    id BIGSERIAL PRIMARY KEY,
    seller VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL DEFAULT 'regular',
    start_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    end_time TIMESTAMPTZ,
    status VARCHAR(20) NOT NULL DEFAULT 'open',
    initial_cash INTEGER NOT NULL DEFAULT 0,
    cash_expected INTEGER,
    cash_initial INTEGER NOT NULL DEFAULT 0,
    cash_sales INTEGER NOT NULL DEFAULT 0,
    difference INTEGER,
    total_sales INTEGER NOT NULL DEFAULT 0,
    is_open BOOLEAN NOT NULL DEFAULT true,
    opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    closed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    cash_counted INTEGER DEFAULT 0,
    tickets INTEGER,
    payments_breakdown JSONB,
    total_expenses INTEGER DEFAULT 0
);

-- Agregar columnas si no existen (para actualizaciones)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='pudahuel_shifts' AND column_name='cash_counted') THEN
        ALTER TABLE pudahuel_shifts ADD COLUMN cash_counted INTEGER DEFAULT 0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='pudahuel_shifts' AND column_name='total_expenses') THEN
        ALTER TABLE pudahuel_shifts ADD COLUMN total_expenses INTEGER DEFAULT 0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='pudahuel_shifts' AND column_name='start_time') THEN
        ALTER TABLE pudahuel_shifts ADD COLUMN start_time TIMESTAMPTZ NOT NULL DEFAULT NOW();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='pudahuel_shifts' AND column_name='end_time') THEN
        ALTER TABLE pudahuel_shifts ADD COLUMN end_time TIMESTAMPTZ;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='pudahuel_shifts' AND column_name='status') THEN
        ALTER TABLE pudahuel_shifts ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'open';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='pudahuel_shifts' AND column_name='initial_cash') THEN
        ALTER TABLE pudahuel_shifts ADD COLUMN initial_cash INTEGER NOT NULL DEFAULT 0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='pudahuel_shifts' AND column_name='cash_expected') THEN
        ALTER TABLE pudahuel_shifts ADD COLUMN cash_expected INTEGER;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='pudahuel_shifts' AND column_name='difference') THEN
        ALTER TABLE pudahuel_shifts ADD COLUMN difference INTEGER;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='pudahuel_shifts' AND column_name='tickets') THEN
        ALTER TABLE pudahuel_shifts ADD COLUMN tickets INTEGER;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='pudahuel_shifts' AND column_name='payments_breakdown') THEN
        ALTER TABLE pudahuel_shifts ADD COLUMN payments_breakdown JSONB;
    END IF;
END $$;

-- Índices para pudahuel_shifts
CREATE INDEX IF NOT EXISTS idx_pudahuel_shifts_seller ON pudahuel_shifts(seller);
CREATE INDEX IF NOT EXISTS idx_pudahuel_shifts_is_open ON pudahuel_shifts(is_open) WHERE is_open = true;
CREATE INDEX IF NOT EXISTS idx_pudahuel_shifts_opened_at ON pudahuel_shifts(opened_at DESC);
CREATE INDEX IF NOT EXISTS idx_pudahuel_shifts_status ON pudahuel_shifts(status);
CREATE INDEX IF NOT EXISTS idx_pudahuel_shifts_start_time ON pudahuel_shifts(start_time DESC);

-- ========================================
-- 5. TABLA: pudahuel_sales (Ventas)
-- ========================================
CREATE TABLE IF NOT EXISTS pudahuel_sales (
    id BIGSERIAL PRIMARY KEY,
    shift_id BIGINT REFERENCES pudahuel_shifts(id) ON DELETE SET NULL,
    client_id BIGINT REFERENCES pudahuel_clients(id) ON DELETE SET NULL,
    total INTEGER NOT NULL DEFAULT 0,
    ticket TEXT,
    type VARCHAR(20) NOT NULL DEFAULT 'sale',
    seller VARCHAR(255),
    payment_method VARCHAR(50) NOT NULL DEFAULT 'cash',
    cash_received INTEGER,
    change_amount INTEGER,
    items JSONB NOT NULL DEFAULT '[]',
    notes JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para pudahuel_sales
CREATE INDEX IF NOT EXISTS idx_pudahuel_sales_shift_id ON pudahuel_sales(shift_id);
CREATE INDEX IF NOT EXISTS idx_pudahuel_sales_client_id ON pudahuel_sales(client_id);
CREATE INDEX IF NOT EXISTS idx_pudahuel_sales_payment_method ON pudahuel_sales(payment_method);
CREATE INDEX IF NOT EXISTS idx_pudahuel_sales_created_at ON pudahuel_sales(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pudahuel_sales_items ON pudahuel_sales USING GIN (items);

-- ========================================
-- 6. TABLA: pudahuel_client_movements (Movimientos de Crédito)
-- ========================================
CREATE TABLE IF NOT EXISTS pudahuel_client_movements (
    id BIGSERIAL PRIMARY KEY,
    client_id BIGINT NOT NULL REFERENCES pudahuel_clients(id) ON DELETE CASCADE,
    sale_id BIGINT REFERENCES pudahuel_sales(id) ON DELETE SET NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('cargo', 'pago', 'fiado', 'abono', 'pago-total')),
    amount INTEGER NOT NULL,
    notes TEXT,
    balance_after INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para pudahuel_client_movements
CREATE INDEX IF NOT EXISTS idx_pudahuel_client_movements_client_id ON pudahuel_client_movements(client_id);
CREATE INDEX IF NOT EXISTS idx_pudahuel_client_movements_sale_id ON pudahuel_client_movements(sale_id);
CREATE INDEX IF NOT EXISTS idx_pudahuel_client_movements_type ON pudahuel_client_movements(type);
CREATE INDEX IF NOT EXISTS idx_pudahuel_client_movements_created_at ON pudahuel_client_movements(created_at DESC);

-- ========================================
-- 7. TABLA: pudahuel_shift_expenses (Gastos de Turno)
-- ========================================
CREATE TABLE IF NOT EXISTS pudahuel_shift_expenses (
    id BIGSERIAL PRIMARY KEY,
    shift_id BIGINT NOT NULL REFERENCES pudahuel_shifts(id) ON DELETE CASCADE,
    expense_type VARCHAR(50) NOT NULL CHECK (expense_type IN ('sueldo', 'flete', 'proveedor', 'otro')),
    amount INTEGER NOT NULL CHECK (amount > 0),
    supplier_name VARCHAR(255),
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para pudahuel_shift_expenses
CREATE INDEX IF NOT EXISTS idx_pudahuel_shift_expenses_shift_id ON pudahuel_shift_expenses(shift_id);
CREATE INDEX IF NOT EXISTS idx_pudahuel_shift_expenses_type ON pudahuel_shift_expenses(expense_type);
CREATE INDEX IF NOT EXISTS idx_pudahuel_shift_expenses_created_at ON pudahuel_shift_expenses(created_at DESC);

-- ========================================
-- 8. POLÍTICAS RLS (Row Level Security)
-- ========================================

-- Habilitar RLS en todas las tablas
ALTER TABLE pudahuel_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE pudahuel_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE pudahuel_shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE pudahuel_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE pudahuel_client_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE pudahuel_shift_expenses ENABLE ROW LEVEL SECURITY;

-- Eliminar políticas existentes si existen
DROP POLICY IF EXISTS "Permitir lectura pública de productos" ON pudahuel_products;
DROP POLICY IF EXISTS "Permitir inserción de productos" ON pudahuel_products;
DROP POLICY IF EXISTS "Permitir actualización de productos" ON pudahuel_products;
DROP POLICY IF EXISTS "Permitir eliminación de productos" ON pudahuel_products;

DROP POLICY IF EXISTS "Permitir lectura pública de clientes" ON pudahuel_clients;
DROP POLICY IF EXISTS "Permitir inserción de clientes" ON pudahuel_clients;
DROP POLICY IF EXISTS "Permitir actualización de clientes" ON pudahuel_clients;
DROP POLICY IF EXISTS "Permitir eliminación de clientes" ON pudahuel_clients;

DROP POLICY IF EXISTS "Permitir lectura pública de turnos" ON pudahuel_shifts;
DROP POLICY IF EXISTS "Permitir inserción de turnos" ON pudahuel_shifts;
DROP POLICY IF EXISTS "Permitir actualización de turnos" ON pudahuel_shifts;
DROP POLICY IF EXISTS "Permitir eliminación de turnos" ON pudahuel_shifts;

DROP POLICY IF EXISTS "Permitir lectura pública de ventas" ON pudahuel_sales;
DROP POLICY IF EXISTS "Permitir inserción de ventas" ON pudahuel_sales;
DROP POLICY IF EXISTS "Permitir actualización de ventas" ON pudahuel_sales;
DROP POLICY IF EXISTS "Permitir eliminación de ventas" ON pudahuel_sales;

DROP POLICY IF EXISTS "Permitir lectura pública de movimientos" ON pudahuel_client_movements;
DROP POLICY IF EXISTS "Permitir inserción de movimientos" ON pudahuel_client_movements;
DROP POLICY IF EXISTS "Permitir actualización de movimientos" ON pudahuel_client_movements;
DROP POLICY IF EXISTS "Permitir eliminación de movimientos" ON pudahuel_client_movements;

DROP POLICY IF EXISTS "Permitir lectura de gastos" ON pudahuel_shift_expenses;
DROP POLICY IF EXISTS "Permitir inserción de gastos" ON pudahuel_shift_expenses;
DROP POLICY IF EXISTS "Permitir actualización de gastos" ON pudahuel_shift_expenses;
DROP POLICY IF EXISTS "Permitir eliminación de gastos" ON pudahuel_shift_expenses;

-- Crear políticas
CREATE POLICY "Permitir lectura pública de productos" ON pudahuel_products FOR SELECT USING (true);
CREATE POLICY "Permitir inserción de productos" ON pudahuel_products FOR INSERT WITH CHECK (true);
CREATE POLICY "Permitir actualización de productos" ON pudahuel_products FOR UPDATE USING (true);
CREATE POLICY "Permitir eliminación de productos" ON pudahuel_products FOR DELETE USING (true);

CREATE POLICY "Permitir lectura pública de clientes" ON pudahuel_clients FOR SELECT USING (true);
CREATE POLICY "Permitir inserción de clientes" ON pudahuel_clients FOR INSERT WITH CHECK (true);
CREATE POLICY "Permitir actualización de clientes" ON pudahuel_clients FOR UPDATE USING (true);
CREATE POLICY "Permitir eliminación de clientes" ON pudahuel_clients FOR DELETE USING (true);

CREATE POLICY "Permitir lectura pública de turnos" ON pudahuel_shifts FOR SELECT USING (true);
CREATE POLICY "Permitir inserción de turnos" ON pudahuel_shifts FOR INSERT WITH CHECK (true);
CREATE POLICY "Permitir actualización de turnos" ON pudahuel_shifts FOR UPDATE USING (true);
CREATE POLICY "Permitir eliminación de turnos" ON pudahuel_shifts FOR DELETE USING (true);

CREATE POLICY "Permitir lectura pública de ventas" ON pudahuel_sales FOR SELECT USING (true);
CREATE POLICY "Permitir inserción de ventas" ON pudahuel_sales FOR INSERT WITH CHECK (true);
CREATE POLICY "Permitir actualización de ventas" ON pudahuel_sales FOR UPDATE USING (true);
CREATE POLICY "Permitir eliminación de ventas" ON pudahuel_sales FOR DELETE USING (true);

CREATE POLICY "Permitir lectura pública de movimientos" ON pudahuel_client_movements FOR SELECT USING (true);
CREATE POLICY "Permitir inserción de movimientos" ON pudahuel_client_movements FOR INSERT WITH CHECK (true);
CREATE POLICY "Permitir actualización de movimientos" ON pudahuel_client_movements FOR UPDATE USING (true);
CREATE POLICY "Permitir eliminación de movimientos" ON pudahuel_client_movements FOR DELETE USING (true);

CREATE POLICY "Permitir lectura de gastos" ON pudahuel_shift_expenses FOR SELECT USING (true);
CREATE POLICY "Permitir inserción de gastos" ON pudahuel_shift_expenses FOR INSERT WITH CHECK (true);
CREATE POLICY "Permitir actualización de gastos" ON pudahuel_shift_expenses FOR UPDATE USING (true);
CREATE POLICY "Permitir eliminación de gastos" ON pudahuel_shift_expenses FOR DELETE USING (true);

-- ========================================
-- 9. VISTAS ÚTILES
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

-- Vista de clientes con deuda
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

-- Vista de resumen de gastos por turno (DEBE IR ANTES de pudahuel_active_shifts)
CREATE OR REPLACE VIEW pudahuel_shift_expenses_summary AS
SELECT
    shift_id,
    COUNT(*) as total_expenses_count,
    SUM(amount) as total_expenses_amount,
    SUM(CASE WHEN expense_type = 'sueldo' THEN amount ELSE 0 END) as total_sueldo,
    SUM(CASE WHEN expense_type = 'flete' THEN amount ELSE 0 END) as total_flete,
    SUM(CASE WHEN expense_type = 'proveedor' THEN amount ELSE 0 END) as total_proveedor,
    SUM(CASE WHEN expense_type = 'otro' THEN amount ELSE 0 END) as total_otro
FROM pudahuel_shift_expenses
GROUP BY shift_id;

-- Vista de turnos activos (usa pudahuel_shift_expenses_summary)
CREATE OR REPLACE VIEW pudahuel_active_shifts AS
SELECT
    s.id,
    s.seller,
    s.type,
    s.cash_initial,
    s.cash_sales,
    s.total_sales,
    s.cash_counted,
    s.total_expenses,
    (s.total_sales - s.cash_sales) as other_sales,
    COALESCE(e.total_expenses_amount, 0) as expenses_total,
    s.opened_at,
    EXTRACT(EPOCH FROM (NOW() - s.opened_at))/3600 as hours_open
FROM pudahuel_shifts s
LEFT JOIN pudahuel_shift_expenses_summary e ON s.id = e.shift_id
WHERE s.is_open = true
ORDER BY s.opened_at DESC;

-- ========================================
-- 10. FUNCIONES ÚTILES
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

-- Función para calcular total de gastos de un turno
CREATE OR REPLACE FUNCTION pudahuel_calculate_shift_expenses(p_shift_id BIGINT)
RETURNS INTEGER AS $$
DECLARE
    v_total INTEGER;
BEGIN
    SELECT COALESCE(SUM(amount), 0)
    INTO v_total
    FROM pudahuel_shift_expenses
    WHERE shift_id = p_shift_id;

    RETURN v_total;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- 11. TRIGGERS PARA ACTUALIZAR TOTAL DE GASTOS
-- ========================================

-- Función para actualizar total_expenses automáticamente
CREATE OR REPLACE FUNCTION pudahuel_update_shift_expenses_total()
RETURNS TRIGGER AS $$
DECLARE
    v_shift_id BIGINT;
    v_new_total INTEGER;
BEGIN
    -- Obtener el shift_id
    IF TG_OP = 'DELETE' THEN
        v_shift_id := OLD.shift_id;
    ELSE
        v_shift_id := NEW.shift_id;
    END IF;

    -- Calcular nuevo total
    SELECT COALESCE(SUM(amount), 0)
    INTO v_new_total
    FROM pudahuel_shift_expenses
    WHERE shift_id = v_shift_id;

    -- Actualizar el total en la tabla shifts
    UPDATE pudahuel_shifts
    SET total_expenses = v_new_total
    WHERE id = v_shift_id;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Crear triggers para gastos
CREATE TRIGGER trigger_update_shift_expenses_insert
    AFTER INSERT ON pudahuel_shift_expenses
    FOR EACH ROW
    EXECUTE FUNCTION pudahuel_update_shift_expenses_total();

CREATE TRIGGER trigger_update_shift_expenses_update
    AFTER UPDATE ON pudahuel_shift_expenses
    FOR EACH ROW
    EXECUTE FUNCTION pudahuel_update_shift_expenses_total();

CREATE TRIGGER trigger_update_shift_expenses_delete
    AFTER DELETE ON pudahuel_shift_expenses
    FOR EACH ROW
    EXECUTE FUNCTION pudahuel_update_shift_expenses_total();

-- ========================================
-- 12. DATOS DE EJEMPLO (OPCIONAL)
-- ========================================

-- Insertar productos de ejemplo (solo si no existen)
INSERT INTO pudahuel_products (name, barcode, category, cost, price, stock, stock_min)
VALUES
('Coca Cola 500ml', '7501234567890', 'Bebidas', 800, 1200, 24, 10),
('Pan Hallulla', '7501234567891', 'Panadería', 300, 500, 15, 20),
('Leche Entera 1L', '7501234567892', 'Lácteos', 900, 1300, 8, 12),
('Café Nescafé 170g', '7501234567893', 'Despensa', 3500, 5000, 5, 8),
('Arroz 1kg', '7501234567894', 'Abarrotes', 1200, 1800, 30, 15)
ON CONFLICT DO NOTHING;

-- Insertar clientes de ejemplo (solo si no existen)
INSERT INTO pudahuel_clients (name, contact, credit_limit, balance)
VALUES
('Juan Pérez', '+56912345678', 50000, 0),
('María González', '+56987654321', 30000, 5000),
('Pedro Soto', '+56911223344', 40000, 15000)
ON CONFLICT DO NOTHING;

-- ========================================
-- VERIFICACIÓN FINAL
-- ========================================

-- Ver todas las tablas creadas
SELECT
    'Tabla creada: ' || table_name as mensaje
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name LIKE 'pudahuel%'
ORDER BY table_name;

-- Contar registros
SELECT
    'Productos: ' || COUNT(*) as conteo
FROM pudahuel_products
UNION ALL
SELECT
    'Clientes: ' || COUNT(*)
FROM pudahuel_clients
UNION ALL
SELECT
    'Turnos: ' || COUNT(*)
FROM pudahuel_shifts
UNION ALL
SELECT
    'Ventas: ' || COUNT(*)
FROM pudahuel_sales
UNION ALL
SELECT
    'Gastos: ' || COUNT(*)
FROM pudahuel_shift_expenses;
