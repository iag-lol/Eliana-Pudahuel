import type { SupabaseClient } from "@supabase/supabase-js";
import dayjs from "dayjs";
import type { ReportFilters } from "../types";
import type { StockRequest } from "../types";

export const PRODUCT_COLUMNS = "id,name,barcode,category,price,stock,stock_min,created_at,updated_at";
export const CLIENT_COLUMNS = 'id, name, authorized, balance, "limit", payment_schedule, updated_at';
export const SHIFT_COLUMNS = "id,seller,type,start_time,end_time,status,initial_cash,cash_expected,cash_counted,difference,total_sales,tickets,payments_breakdown,total_expenses,created_at";
export const EXPENSE_COLUMNS = "id,shift_id,expense_type,amount,supplier_name,description,created_at,paid_from_cash";
export const STOCK_REQUEST_COLUMNS = "id,product_id,product_name,requested_qty,final_qty,requested_by,requested_at,created_at,updated_at";
export const STOCK_REQUEST_WRITE_COLUMNS = "id,product_id,product_name,requested_qty,final_qty,requested_by,requested_at,created_at";
export const SALES_LIGHT_COLUMNS = "id,ticket,type,total,payment_method,cash_received,change_amount,shift_id,client_id,seller,created_at";
export const SALES_DETAIL_COLUMNS = `${SALES_LIGHT_COLUMNS},items`;
export const SALES_WRITE_RETURN_COLUMNS = SALES_LIGHT_COLUMNS;

export const STOCK_REQUESTS_LIMIT = 100;
export const CLIENT_HISTORY_LOOKBACK_DAYS = 120;
export const CLIENT_FIADO_HISTORY_LIMIT = 200;
export const SALES_DEFAULT_LOOKBACK_DAYS = 30;
export const SALES_INVENTORY_LOOKBACK_DAYS = 90;
export const SALES_PAGE_SIZE = 100;
export const PRODUCTS_FETCH_LIMIT = 500;
export const CLIENTS_FETCH_LIMIT = 500;
export const SHIFTS_FETCH_LIMIT = 300;
export const EXPENSES_FETCH_LIMIT = 300;

export type SalesDateRange = {
  from: string;
  to: string;
};

export const getSalesDateRangeForTab = (activeTab: string, reportFilters: ReportFilters): SalesDateRange => {
  const now = dayjs();

  if (activeTab === "reports") {
    switch (reportFilters.range) {
      case "today":
        return { from: now.startOf("day").toISOString(), to: now.endOf("day").toISOString() };
      case "week":
        return { from: now.startOf("week").toISOString(), to: now.endOf("week").toISOString() };
      case "month":
        return { from: now.startOf("month").toISOString(), to: now.endOf("month").toISOString() };
      case "custom": {
        const from = reportFilters.from ? dayjs(reportFilters.from).startOf("day") : now.subtract(SALES_DEFAULT_LOOKBACK_DAYS, "day").startOf("day");
        const to = reportFilters.to ? dayjs(reportFilters.to).endOf("day") : now.endOf("day");
        return { from: from.toISOString(), to: to.toISOString() };
      }
      default:
        break;
    }
  }

  if (activeTab === "inventory" || activeTab === "shifts") {
    return {
      from: now.subtract(SALES_INVENTORY_LOOKBACK_DAYS, "day").startOf("day").toISOString(),
      to: now.endOf("day").toISOString()
    };
  }

  return {
    from: now.subtract(SALES_DEFAULT_LOOKBACK_DAYS, "day").startOf("day").toISOString(),
    to: now.endOf("day").toISOString()
  };
};

export const fetchSalesPage = async (
  client: SupabaseClient,
  params: {
    from: string;
    to: string;
    page: number;
    pageSize?: number;
    includeItems?: boolean;
    includeCount?: boolean;
  }
): Promise<any> => {
  const pageSize = params.pageSize ?? SALES_PAGE_SIZE;
  const fromIdx = Math.max(0, params.page) * pageSize;
  const toIdx = fromIdx + pageSize - 1;
  const columns = params.includeItems ? SALES_DETAIL_COLUMNS : SALES_LIGHT_COLUMNS;
  const selectOptions = params.includeCount ? { count: "exact" as const } : undefined;

  return client
    .from("pudahuel_sales")
    .select(columns, selectOptions)
    .gte("created_at", params.from)
    .lte("created_at", params.to)
    .order("created_at", { ascending: false })
    .range(fromIdx, toIdx);
};

export const applyStockRequestRealtimeDelta = ({
  previous = [],
  eventType,
  newRow,
  oldRow,
  mapRow,
  limit
}: {
  previous?: StockRequest[];
  eventType: "INSERT" | "UPDATE" | "DELETE";
  newRow?: Record<string, unknown> | null;
  oldRow?: Record<string, unknown> | null;
  mapRow: (row: Record<string, unknown>) => StockRequest;
  limit: number;
}) => {
  const sortDesc = (rows: StockRequest[]) =>
    rows
      .slice()
      .sort((a, b) => dayjs(b.requestedAt).valueOf() - dayjs(a.requestedAt).valueOf())
      .slice(0, limit);

  if (eventType === "DELETE") {
    const deletedId = oldRow?.id?.toString?.();
    if (!deletedId) return previous;
    return previous.filter((row) => row.id !== deletedId);
  }

  if (!newRow) return previous;
  const mapped = mapRow(newRow);

  if (eventType === "INSERT") {
    const withoutDuplicate = previous.filter((row) => row.id !== mapped.id);
    return sortDesc([mapped, ...withoutDuplicate]);
  }

  return previous.map((row) => (row.id === mapped.id ? mapped : row));
};
