export type PaymentMethod = "cash" | "card" | "transfer" | "fiado" | "staff";

export interface Product {
  id: string;
  name: string;
  barcode?: string | null;
  category: string;
  price: number;
  stock: number;
  minStock: number;
  created_at?: string;
  updated_at?: string;
}

export interface CartLine {
  productId: string;
  quantity: number;
}

export type PaymentSchedule = "immediate" | "biweekly" | "monthly";

export interface Client {
  id: string;
  name: string;
  authorized: boolean;
  balance: number;
  limit: number;
  payment_schedule?: PaymentSchedule;
  updated_at?: string;
  history?: ClientMovement[];
}

export interface ClientMovement {
  id: string;
  client_id: string;
  amount: number;
  type: "abono" | "pago-total" | "fiado";
  description: string;
  created_at: string;
  balance_after: number;
}

export interface SaleItem {
  id: string;
  productId: string;
  name: string;
  price: number;
  quantity: number;
}

export interface Sale {
  id: string;
  ticket: string;
  type: "sale" | "return";
  total: number;
  paymentMethod: PaymentMethod;
  cashReceived?: number | null;
  change?: number | null;
  shiftId?: string | null;
  seller?: string | null;
  created_at: string;
  items: SaleItem[];
  notes?: Record<string, unknown> | null;
}

export type ShiftType = "dia" | "noche";

export interface Shift {
  id: string;
  seller: string;
  type: ShiftType;
  start: string;
  end?: string | null;
  status: "open" | "closed";
  initial_cash?: number | null;
  cash_expected?: number | null;
  cash_counted?: number | null;
  difference?: number | null;
  total_sales?: number | null;
  tickets?: number | null;
  payments_breakdown?: Record<PaymentMethod, number> | null;
  total_expenses?: number | null;
  expenses?: ShiftExpense[];
}

export interface ShiftSummary {
  total: number;
  tickets: number;
  byPayment: Record<PaymentMethod, number>;
}

export interface ReportFilters {
  range: "today" | "week" | "month" | "custom";
  from?: string | null;
  to?: string | null;
}

export type ExpenseType = "sueldo" | "flete" | "proveedor" | "otro" | "operacion";

export interface ShiftExpense {
  id: string;
  shift_id: string;
  expense_type: ExpenseType;
  amount: number;
  supplier_name?: string | null;
  description?: string | null;
  created_at: string;
  paid_from_cash?: boolean;
}
