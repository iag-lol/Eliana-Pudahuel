-- ========================================
-- ACTUALIZACIÓN: SISTEMA DE GASTOS PARA TURNOS
-- Base de datos: Pudahuel
-- ========================================

-- ========================================
-- 1. TABLA: pudahuel_shift_expenses (Gastos de Turno)
-- ========================================
CREATE TABLE IF NOT EXISTS pudahuel_shift_expenses (
    id BIGSERIAL PRIMARY KEY,
    shift_id BIGINT NOT NULL REFERENCES pudahuel_shifts(id) ON DELETE CASCADE,
    expense_type VARCHAR(50) NOT NULL CHECK (expense_type IN ('sueldo', 'flete', 'proveedor', 'otro', 'operacion')),
    amount INTEGER NOT NULL CHECK (amount > 0),
    supplier_name VARCHAR(255),
    description TEXT,
    paid_from_cash BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para pudahuel_shift_expenses
CREATE INDEX IF NOT EXISTS idx_pudahuel_shift_expenses_shift_id ON pudahuel_shift_expenses(shift_id);
CREATE INDEX IF NOT EXISTS idx_pudahuel_shift_expenses_type ON pudahuel_shift_expenses(expense_type);
CREATE INDEX IF NOT EXISTS idx_pudahuel_shift_expenses_created_at ON pudahuel_shift_expenses(created_at DESC);

-- Comentarios
COMMENT ON TABLE pudahuel_shift_expenses IS 'Registro de gastos realizados durante un turno';
COMMENT ON COLUMN pudahuel_shift_expenses.expense_type IS 'Tipo de gasto: sueldo, flete, proveedor, operacion u otro';
COMMENT ON COLUMN pudahuel_shift_expenses.supplier_name IS 'Nombre del proveedor (obligatorio si expense_type es proveedor)';
COMMENT ON COLUMN pudahuel_shift_expenses.description IS 'Descripción adicional del gasto';
COMMENT ON COLUMN pudahuel_shift_expenses.paid_from_cash IS 'Indica si el gasto se pagó con efectivo y debe descontarse de caja';

-- Ajustes para instalaciones existentes
DO $$ BEGIN
    ALTER TABLE pudahuel_shift_expenses DROP CONSTRAINT IF EXISTS pudahuel_shift_expenses_expense_type_check;
    ALTER TABLE pudahuel_shift_expenses ADD CONSTRAINT pudahuel_shift_expenses_expense_type_check
        CHECK (expense_type IN ('sueldo', 'flete', 'proveedor', 'otro', 'operacion'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE pudahuel_shift_expenses
    ADD COLUMN IF NOT EXISTS paid_from_cash BOOLEAN NOT NULL DEFAULT TRUE;

-- ========================================
-- 2. MODIFICAR TABLA: pudahuel_shifts (Agregar campos de gastos y efectivo en caja)
-- ========================================

-- Agregar columna para el efectivo real contado en caja al cierre
ALTER TABLE pudahuel_shifts
ADD COLUMN IF NOT EXISTS cash_counted INTEGER DEFAULT 0;

-- Agregar columna para total de gastos del turno
ALTER TABLE pudahuel_shifts
ADD COLUMN IF NOT EXISTS total_expenses INTEGER DEFAULT 0;

-- Agregar comentarios
COMMENT ON COLUMN pudahuel_shifts.cash_counted IS 'Efectivo real contado en caja al cerrar el turno';
COMMENT ON COLUMN pudahuel_shifts.total_expenses IS 'Total de gastos realizados durante el turno';

-- ========================================
-- 3. POLÍTICAS RLS PARA pudahuel_shift_expenses
-- ========================================

-- Habilitar RLS
ALTER TABLE pudahuel_shift_expenses ENABLE ROW LEVEL SECURITY;

-- Políticas
CREATE POLICY "Permitir lectura de gastos" ON pudahuel_shift_expenses
    FOR SELECT USING (true);

CREATE POLICY "Permitir inserción de gastos" ON pudahuel_shift_expenses
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Permitir actualización de gastos" ON pudahuel_shift_expenses
    FOR UPDATE USING (true);

CREATE POLICY "Permitir eliminación de gastos" ON pudahuel_shift_expenses
    FOR DELETE USING (true);

-- ========================================
-- 4. VISTA: pudahuel_shift_expenses_summary
-- ========================================

-- Vista para resumen de gastos por turno
CREATE OR REPLACE VIEW pudahuel_shift_expenses_summary AS
SELECT
    shift_id,
    COUNT(*) as total_expenses_count,
    COALESCE(SUM(amount), 0) as total_expenses_amount,
    COALESCE(SUM(CASE WHEN expense_type = 'sueldo' THEN amount ELSE 0 END), 0) as total_sueldo,
    COALESCE(SUM(CASE WHEN expense_type = 'flete' THEN amount ELSE 0 END), 0) as total_flete,
    COALESCE(SUM(CASE WHEN expense_type = 'proveedor' THEN amount ELSE 0 END), 0) as total_proveedor,
    COALESCE(SUM(CASE WHEN expense_type = 'otro' THEN amount ELSE 0 END), 0) as total_otro,
    COALESCE(SUM(CASE WHEN expense_type = 'operacion' THEN amount ELSE 0 END), 0) as total_operacion,
    COALESCE(SUM(CASE WHEN paid_from_cash THEN amount ELSE 0 END), 0) as total_paid_from_cash
FROM pudahuel_shift_expenses
GROUP BY shift_id;

COMMENT ON VIEW pudahuel_shift_expenses_summary IS 'Resumen de gastos agrupados por turno';

-- ========================================
-- 5. VISTA MEJORADA: pudahuel_active_shifts (Incluir gastos)
-- ========================================

DROP VIEW IF EXISTS pudahuel_active_shifts;

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
    COALESCE(e.total_paid_from_cash, 0) as expenses_cash_total,
    s.opened_at,
    EXTRACT(EPOCH FROM (NOW() - s.opened_at))/3600 as hours_open
FROM pudahuel_shifts s
LEFT JOIN pudahuel_shift_expenses_summary e ON s.id = e.shift_id
WHERE s.is_open = true
ORDER BY s.opened_at DESC;

-- ========================================
-- 6. FUNCIÓN: Calcular total de gastos de un turno
-- ========================================

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

COMMENT ON FUNCTION pudahuel_calculate_shift_expenses IS 'Calcula el total de gastos de un turno específico';

-- ========================================
-- 7. TRIGGER: Actualizar total_expenses al insertar/actualizar/eliminar gasto
-- ========================================

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

-- Crear triggers
DROP TRIGGER IF EXISTS trigger_update_shift_expenses_insert ON pudahuel_shift_expenses;
DROP TRIGGER IF EXISTS trigger_update_shift_expenses_update ON pudahuel_shift_expenses;
DROP TRIGGER IF EXISTS trigger_update_shift_expenses_delete ON pudahuel_shift_expenses;

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
-- 8. DATOS DE EJEMPLO (OPCIONAL)
-- ========================================

-- Insertar gastos de ejemplo para el turno activo (si existe)
-- Comentar estas líneas si no quieres datos de prueba
/*
INSERT INTO pudahuel_shift_expenses (shift_id, expense_type, amount, supplier_name, description)
SELECT id, 'sueldo', 50000, NULL, 'Pago de turno vendedor'
FROM pudahuel_shifts
WHERE is_open = true
LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO pudahuel_shift_expenses (shift_id, expense_type, amount, supplier_name, description)
SELECT id, 'proveedor', 25000, 'Distribuidora Central', 'Compra de mercadería'
FROM pudahuel_shifts
WHERE is_open = true
LIMIT 1
ON CONFLICT DO NOTHING;
*/

-- ========================================
-- VERIFICACIÓN: Consultas útiles para verificar la instalación
-- ========================================

-- Ver todas las tablas relacionadas con shifts
-- SELECT table_name FROM information_schema.tables WHERE table_name LIKE 'pudahuel_%' ORDER BY table_name;

-- Ver gastos de turnos activos
-- SELECT s.seller, s.opened_at, e.*
-- FROM pudahuel_shift_expenses e
-- JOIN pudahuel_shifts s ON e.shift_id = s.id
-- WHERE s.is_open = true;

-- Ver resumen de gastos por turno
-- SELECT * FROM pudahuel_shift_expenses_summary;

-- ========================================
-- RESUMEN DE CAMBIOS
-- ========================================

/*
NUEVAS CARACTERÍSTICAS:

1. TABLA pudahuel_shift_expenses:
   - Registro completo de gastos por turno
   - Categorías: sueldo, flete, proveedor, otro
   - Campo para nombre de proveedor
   - Descripción opcional

2. COLUMNAS AGREGADAS A pudahuel_shifts:
   - cash_counted: Efectivo real contado al cierre
   - total_expenses: Total de gastos del turno

3. TRIGGERS AUTOMÁTICOS:
   - Actualización automática de total_expenses al agregar/modificar/eliminar gastos

4. VISTAS:
   - pudahuel_shift_expenses_summary: Resumen de gastos por turno
   - pudahuel_active_shifts: Actualizada para incluir gastos

5. FUNCIONES:
   - pudahuel_calculate_shift_expenses: Calcular gastos de un turno

INSTRUCCIONES:
1. Ejecuta este script en el SQL Editor de Supabase
2. Verifica que no haya errores
3. Las tablas y funciones estarán listas para usar
*/

-- ========================================
-- FIN DEL SCRIPT DE ACTUALIZACIÓN
-- ========================================
