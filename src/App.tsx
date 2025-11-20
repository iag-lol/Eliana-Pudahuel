import "./App.css";
import {
  Accordion,
  ActionIcon,
  AppShell,
  Autocomplete,
  Badge,
  Box,
  Button,
  Card,
  Chip,
  Divider,
  Drawer,
  Grid,
  Group,
  Modal,
  NumberInput,
  Paper,
  ScrollArea,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Table,
  Text,
  TextInput,
  ThemeIcon,
  Title,
  Tooltip,
  Progress,
  useMantineColorScheme
} from "@mantine/core";
import { Notifications, notifications } from "@mantine/notifications";
import { useDisclosure, useMediaQuery } from "@mantine/hooks";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis,
  Cell
} from "recharts";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import "dayjs/locale/es";
import {
  AlertTriangle,
  BadgeCheck,
  BarChart3,
  BoxIcon,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Clock3,
  CreditCard,
  ArrowLeftRight,
  Coins,
  DollarSign,
  Edit,
  Filter,
  KeyRound,
  LayoutDashboard,
  LucideIcon,
  MonitorPlay,
  Moon,
  Package,
  PiggyBank,
  Plus,
  Receipt,
  RefreshCcw,
  Search,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  Trash2,
  Sun,
  TrendingUp,
  User,
  UserPlus,
  UsersRound,
  Wallet,
  Waypoints,
  X
} from "lucide-react";
import { supabase } from "./lib/supabaseClient";
import {
  CartLine,
  Client,
  ClientMovement,
  PaymentMethod,
  Product,
  ReportFilters,
  Sale,
  SaleItem,
  Shift,
  ShiftSummary,
  ShiftType
} from "./types";
import { FALLBACK_CLIENTS, FALLBACK_PRODUCTS, FALLBACK_SALES, FALLBACK_SHIFTS } from "./data/fallback";
import { formatCurrency, formatDate, formatDateTime, formatTime } from "./utils/format";

dayjs.extend(relativeTime);
dayjs.locale("es");

// Sistema de roles y contraseñas
type Role = "admin" | "manager";

const ADMIN_PASSWORD = "eliana152100"; // Acceso completo
const MANAGER_PASSWORD = "selena1521"; // Solo dashboard, POS, inventario

type TabId = "dashboard" | "pos" | "inventory" | "fiados" | "reports" | "shifts";

interface TabConfig {
  id: TabId;
  label: string;
  icon: LucideIcon;
  requiredRole?: Role; // Si no tiene requiredRole, es accesible para todos
}

const TABS: TabConfig[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "pos", label: "Punto de venta", icon: ShoppingCart },
  { id: "inventory", label: "Inventario", icon: BoxIcon, requiredRole: "manager" }, // manager o superior
  { id: "fiados", label: "Clientes fiados", icon: UsersRound, requiredRole: "admin" }, // solo admin
  { id: "reports", label: "Reportes", icon: BarChart3, requiredRole: "admin" }, // solo admin
  { id: "shifts", label: "Turnos", icon: Clock3, requiredRole: "admin" } // solo admin
];

interface PaymentOption {
  id: PaymentMethod;
  label: string;
  description: string;
  icon: LucideIcon;
  accent: string;
}

const PAYMENT_OPTIONS: PaymentOption[] = [
  {
    id: "cash",
    label: "Efectivo",
    description: "Controla el ingreso de efectivo y calcula el cambio automáticamente.",
    icon: Wallet,
    accent: "teal"
  },
  {
    id: "card",
    label: "Tarjeta",
    description: "Pagos con débito o crédito, registra voucher y posibles reversos.",
    icon: CreditCard,
    accent: "indigo"
  },
  {
    id: "transfer",
    label: "Transferencia",
    description: "Pagos con comprobante electrónico o QR bancario.",
    icon: ArrowLeftRight,
    accent: "cyan"
  },
  {
    id: "fiado",
    label: "Fiado",
    description: "Asocia la venta a un cliente autorizado y actualiza su deuda.",
    icon: ShieldCheck,
    accent: "orange"
  },
  {
    id: "staff",
    label: "Consumo del personal",
    description: "Controla consumos internos vinculados al turno activo.",
    icon: BadgeCheck,
    accent: "pink"
  }
];

const SHIFT_TYPES: { label: string; value: ShiftType }[] = [
  { label: "Turno Día", value: "dia" },
  { label: "Turno Noche", value: "noche" }
];

const REPORT_RANGES: { label: string; value: ReportFilters["range"] }[] = [
  { label: "Hoy", value: "today" },
  { label: "Semana", value: "week" },
  { label: "Mes", value: "month" },
  { label: "Personalizado", value: "custom" }
];

const PAYMENT_COLORS: Record<PaymentMethod, string> = {
  cash: "#12b886",
  card: "#4263eb",
  transfer: "#1098ad",
  fiado: "#f76707",
  staff: "#e64980"
};

const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  cash: "Efectivo",
  card: "Tarjeta",
  transfer: "Transferencia",
  fiado: "Fiado",
  staff: "Consumo del personal"
};

const PAYMENT_ORDER: PaymentMethod[] = ["cash", "card", "transfer", "fiado", "staff"];

const mapProductRow = (row: any): Product => ({
  id: row.id,
  name: row.name,
  barcode: row.barcode,
  category: row.category,
  price: row.price ?? 0,
  stock: row.stock ?? 0,
  minStock: row.min_stock ?? 5,
  created_at: row.created_at,
  updated_at: row.updated_at
});

const toNumber = (value: unknown): number => {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

const mapClientRow = (row: any): Client => {
  const limitValue = toNumber(row.limit);

  // Debug: mostrar valores para diagnosticar
  if (limitValue === 0 && row.limit !== 0) {
    console.warn("⚠️ Cliente con límite en 0:", {
      name: row.name,
      rawLimit: row.limit,
      parsedLimit: limitValue,
      rowData: row
    });
  }

  return {
    id: row.id,
    name: row.name,
    authorized: row.authorized ?? false,
    balance: toNumber(row.balance),
    limit: limitValue,
    updated_at: row.updated_at
  };
};

const mapSaleRow = (row: any): Sale => ({
  id: row.id,
  ticket: row.ticket,
  type: row.type ?? "sale",
  total: row.total ?? 0,
  paymentMethod: row.payment_method ?? "cash",
  cashReceived: row.cash_received,
  change: row.change_amount,
  shiftId: row.shift_id,
  seller: row.seller,
  created_at: row.created_at,
  items: Array.isArray(row.items)
    ? row.items
    : (typeof row.items === "string" ? (JSON.parse(row.items) as SaleItem[]) : []),
  notes: row.notes
});

const mapShiftRow = (row: any): Shift => ({
  id: row.id,
  seller: row.seller,
  type: row.type ?? "dia",
  start: row.start_time ?? row.start ?? row.created_at,
  end: row.end_time ?? row.end ?? null,
  status: row.status ?? (row.end_time ? "closed" : "open"),
  initial_cash: row.initial_cash ?? null,
  cash_expected: row.cash_expected ?? null,
  cash_counted: row.cash_counted ?? null,
  difference: row.difference ?? null,
  total_sales: row.total_sales ?? null,
  tickets: row.tickets ?? null,
  payments_breakdown: row.payments_breakdown ?? null
});

const generateId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;

async function fetchProducts(): Promise<Product[]> {
  const { data, error } = await supabase
    .from("pudahuel_products")
    .select("*")
    .order("name", { ascending: true });

  if (error) {
    console.warn("Fallo al cargar productos, usando datos locales", error.message);
    return FALLBACK_PRODUCTS;
  }

  return (data ?? []).map(mapProductRow);
}

async function fetchClients(): Promise<Client[]> {
  const { data, error } = await supabase
    .from("pudahuel_clients")
    .select('id, name, authorized, balance, "limit", updated_at')
    .order("name", { ascending: true });

  if (error) {
    console.warn("Fallo al cargar clientes, usando datos locales", error.message);
    return FALLBACK_CLIENTS;
  }

  return (data ?? []).map(mapClientRow);
}

async function fetchSales(): Promise<Sale[]> {
  const { data, error } = await supabase
    .from("pudahuel_sales")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.warn("Fallo al cargar ventas, usando datos locales", error.message);
    return FALLBACK_SALES;
  }

  return (data ?? []).map(mapSaleRow);
}

async function fetchShifts(): Promise<Shift[]> {
  const { data, error } = await supabase
    .from("pudahuel_shifts")
    .select("*")
    .order("start_time", { ascending: false });

  if (error) {
    console.warn("Fallo al cargar turnos, usando datos locales", error.message);
    return FALLBACK_SHIFTS;
  }

  return (data ?? []).map(mapShiftRow);
}

const computeShiftSummary = (sales: Sale[], shiftId: string | null | undefined): ShiftSummary => {
  const filtered = sales.filter((sale) => sale.shiftId === shiftId);
  const result: ShiftSummary = {
    total: 0,
    tickets: 0,
    byPayment: {
      cash: 0,
      card: 0,
      transfer: 0,
      fiado: 0,
      staff: 0
    }
  };

  filtered.forEach((sale) => {
    if (sale.type === "return") {
      result.byPayment[sale.paymentMethod] -= sale.total;
      result.total -= sale.total;
      return;
    }
    result.total += sale.total;
    result.tickets += 1;
    result.byPayment[sale.paymentMethod] += sale.total;
  });

  return result;
};

const CustomerDisplay = ({
  cart,
  total,
  change,
  paymentLabel
}: {
  cart: { product: Product; quantity: number; subtotal: number }[];
  total: number;
  change: number;
  paymentLabel: string;
}) => (
  <Box
    style={{
      position: "fixed",
      top: 0,
      left: 0,
      width: "100vw",
      height: "100vh",
      background: "linear-gradient(135deg, #f8fafc 0%, #e0e7ff 50%, #dbeafe 100%)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "2rem",
      overflow: "hidden"
    }}
  >
    <Card
      withBorder
      shadow="2xl"
      radius="xl"
      style={{
        width: "95%",
        maxWidth: "1400px",
        height: "92vh",
        display: "flex",
        flexDirection: "column",
        background: "white",
        border: "2px solid rgba(99, 102, 241, 0.15)",
        boxShadow: "0 25px 60px rgba(30, 58, 138, 0.2), 0 0 0 1px rgba(99, 102, 241, 0.1)"
      }}
    >
      <Stack gap="xl" h="100%" p="xl">
        {/* Header profesional */}
        <Paper
          withBorder
          p="xl"
          radius="lg"
          style={{
            background: "linear-gradient(135deg, #1e3a8a 0%, #3730a3 100%)",
            border: "none"
          }}
        >
          <Group justify="space-between" align="center" wrap="nowrap">
            <Stack gap={4}>
              <Title order={1} c="white" fw={800} size="42px">
                Negocio Eliana Maipú
              </Title>
              <Text size="lg" c="rgba(255,255,255,0.85)" fw={500}>
                ¡Gracias por tu preferencia!
              </Text>
            </Stack>
            {paymentLabel !== "Fiado" && (
              <Badge
                size="xl"
                variant="filled"
                color="teal"
                style={{
                  padding: "1.2rem 2rem",
                  fontSize: "1.25rem",
                  fontWeight: 700,
                  textTransform: "uppercase"
                }}
              >
                {paymentLabel}
              </Badge>
            )}
          </Group>
        </Paper>

        {/* Lista de productos con scroll */}
        <Stack
          gap="lg"
          style={{
            flex: 1,
            overflow: "auto",
            paddingRight: "0.5rem"
          }}
        >
          {cart.length === 0 ? (
            <Paper
              withBorder
              p="3rem"
              radius="xl"
              style={{
                background: "linear-gradient(135deg, rgba(99,102,241,0.05), rgba(59,130,246,0.08))",
                border: "2px dashed rgba(99, 102, 241, 0.3)"
              }}
            >
              <Stack align="center" gap="xl">
                <ThemeIcon
                  size={100}
                  radius="xl"
                  variant="gradient"
                  gradient={{ from: "indigo", to: "blue" }}
                >
                  <ShoppingCart size={60} />
                </ThemeIcon>
                <Text c="dimmed" ta="center" size="xl" fw={600}>
                  Esperando productos...
                </Text>
              </Stack>
            </Paper>
          ) : (
            cart.map((item, index) => (
              <Paper
                key={item.product.id}
                withBorder
                radius="lg"
                p="xl"
                shadow="md"
                style={{
                  background: "linear-gradient(135deg, rgba(255,255,255,0.9), rgba(245,247,250,0.95))",
                  border: "1px solid rgba(99, 102, 241, 0.12)",
                  transition: "all 0.2s ease"
                }}
              >
                <Group justify="space-between" align="center" wrap="nowrap" gap="xl">
                  <Group gap="md" style={{ flex: 1 }}>
                    <Badge
                      size="xl"
                      variant="filled"
                      color="indigo"
                      circle
                      style={{
                        minWidth: "48px",
                        height: "48px",
                        fontSize: "1.25rem",
                        fontWeight: 700
                      }}
                    >
                      {index + 1}
                    </Badge>
                    <Stack gap={4} style={{ flex: 1 }}>
                      <Text fw={700} size="1.5rem" c="dark">
                        {item.product.name}
                      </Text>
                      <Text size="lg" c="dimmed" fw={500}>
                        {item.quantity} unidad{item.quantity > 1 ? "es" : ""} × {formatCurrency(item.product.price)}
                      </Text>
                    </Stack>
                  </Group>
                  <Text
                    fw={800}
                    size="2.25rem"
                    c="indigo"
                    style={{
                      textAlign: "right",
                      minWidth: "180px"
                    }}
                  >
                    {formatCurrency(item.subtotal)}
                  </Text>
                </Group>
              </Paper>
            ))
          )}
        </Stack>

        {/* Total y cambio - área prominente */}
        <Paper
          withBorder
          p="xl"
          radius="lg"
          style={{
            background: "linear-gradient(135deg, rgba(20, 184, 166, 0.08), rgba(13, 148, 136, 0.12))",
            border: "2px solid rgba(20, 184, 166, 0.25)"
          }}
        >
          <Stack gap="lg">
            <Group justify="space-between" align="center">
              <Text size="2rem" fw={700} c="dark" tt="uppercase">
                Total a Pagar
              </Text>
              <Text
                fw={900}
                size="4rem"
                c="teal"
                style={{
                  letterSpacing: "-0.02em",
                  lineHeight: 1
                }}
              >
                {formatCurrency(total)}
              </Text>
            </Group>
            {change > 0 && (
              <>
                <Divider size="md" color="teal" opacity={0.3} />
                <Group justify="space-between" align="center">
                  <Text size="1.5rem" fw={600} c="dimmed" tt="uppercase">
                    Su Cambio
                  </Text>
                  <Text
                    fw={800}
                    size="2.5rem"
                    c="blue"
                    style={{
                      letterSpacing: "-0.02em"
                    }}
                  >
                    {formatCurrency(change)}
                  </Text>
                </Group>
              </>
            )}
          </Stack>
        </Paper>
      </Stack>
    </Card>
  </Box>
);

interface PasswordModalProps {
  opened: boolean;
  onClose: () => void;
  onUnlock: (role: Role) => void;
}

const PasswordModal = ({ opened, onClose, onUnlock }: PasswordModalProps) => {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!opened) {
      setPassword("");
      setError(null);
    }
  }, [opened]);

  const handleUnlock = () => {
    if (password === ADMIN_PASSWORD) {
      notifications.show({
        title: "Acceso completo concedido",
        message: "Todas las secciones administrativas desbloqueadas.",
        color: "teal"
      });
      onUnlock("admin");
      onClose();
    } else if (password === MANAGER_PASSWORD) {
      notifications.show({
        title: "Acceso administrativo concedido",
        message: "Acceso a Dashboard, Punto de venta e Inventario.",
        color: "blue"
      });
      onUnlock("manager");
      onClose();
    } else {
      setError("Contraseña incorrecta. Inténtalo nuevamente.");
      notifications.show({
        title: "Acceso denegado",
        message: "La contraseña ingresada no es válida.",
        color: "red"
      });
    }
  };

  return (
    <Modal opened={opened} onClose={onClose} title="Acceso administrativo" centered>
      <Stack>
        <Text c="dimmed">
          Ingresa la contraseña para administrar inventario, fiados, reportes y turnos.
        </Text>
        <TextInput
          label="Contraseña"
          placeholder="••••••"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.currentTarget.value)}
          error={error ?? undefined}
          autoFocus
        />
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleUnlock} leftSection={<ShieldCheck size={18} />}>
            Desbloquear
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
};

interface ShiftModalProps {
  opened: boolean;
  mode: "open" | "close";
  onClose: () => void;
  onOpenShift: (payload: { seller: string; type: ShiftType; initialCash: number }) => void;
  onCloseShift: (payload: { cashCounted: number }) => void;
  summary: ShiftSummary & { cashExpected: number };
  activeShift?: Shift;
  sales?: Sale[];
  products?: Product[];
}

const ShiftModal = ({ opened, mode, onClose, onOpenShift, onCloseShift, summary, activeShift, sales = [], products = [] }: ShiftModalProps) => {
  const [seller, setSeller] = useState("");
  const [shiftType, setShiftType] = useState<ShiftType>("dia");
  const [initialCash, setInitialCash] = useState<number | undefined>(undefined);
  const [cashCounted, setCashCounted] = useState<number | undefined>(undefined);

  useEffect(() => {
    if (!opened) {
      setSeller("");
      setShiftType("dia");
      setInitialCash(undefined);
      setCashCounted(undefined);
    }
  }, [opened]);

  const countedValue = typeof cashCounted === "number" && Number.isFinite(cashCounted) ? cashCounted : undefined;

  // Calcular productos vendidos en el turno
  const shiftProducts = useMemo(() => {
    if (!activeShift) return [];

    const shiftSales = sales.filter((sale) => sale.shiftId === activeShift.id && sale.type === "sale");
    const productMap = new Map<string, { name: string; quantity: number; total: number }>();

    shiftSales.forEach((sale) => {
      sale.items.forEach((item) => {
        const existing = productMap.get(item.productId);
        if (existing) {
          existing.quantity += item.quantity;
          existing.total += item.price * item.quantity;
        } else {
          productMap.set(item.productId, {
            name: item.name,
            quantity: item.quantity,
            total: item.price * item.quantity
          });
        }
      });
    });

    return Array.from(productMap.values()).sort((a, b) => b.total - a.total);
  }, [activeShift, sales]);

  if (!opened) return null;

  if (mode === "close") {
    return (
      <Modal
        opened={opened}
        onClose={onClose}
        title="Cierre de turno"
        centered
        size="xl"
        styles={{
          body: { padding: 0 },
          content: { maxHeight: "90vh" }
        }}
      >
        <Stack gap={0}>
          {/* Header con información del turno */}
          <Paper p="lg" withBorder radius={0} style={{ background: "linear-gradient(135deg, rgba(66, 99, 235, 0.12), rgba(99, 102, 241, 0.18))", borderBottom: "2px solid #e9ecef" }}>
            <Group justify="space-between" align="flex-start">
              <Stack gap={4}>
                <Group gap="xs">
                  <BadgeCheck size={24} color="#4263eb" />
                  <Title order={3} c="dark">{activeShift?.seller}</Title>
                </Group>
                <Text size="sm" c="dimmed">
                  {activeShift?.type === "dia" ? "Turno Diurno" : "Turno Nocturno"} • {formatDateTime(activeShift?.start ?? "")}
                </Text>
              </Stack>
              <Badge size="xl" variant="light" color="indigo">
                {summary.tickets} Tickets
              </Badge>
            </Group>
          </Paper>

          {/* Resumen financiero en 3 tarjetas horizontales */}
          <Paper p="lg" style={{ borderBottom: "2px solid #f1f3f5" }}>
            <SimpleGrid cols={3} spacing="md">
              <Paper withBorder p="md" radius="lg" style={{ background: "linear-gradient(135deg, rgba(16,185,129,0.08), rgba(16,185,129,0.12))" }}>
                <Stack gap="xs">
                  <Text size="xs" c="dimmed" fw={600} tt="uppercase">Total Ventas</Text>
                  <Text fw={700} size="28px" c="teal">{formatCurrency(summary.total)}</Text>
                </Stack>
              </Paper>
              <Paper withBorder p="md" radius="lg" style={{ background: "linear-gradient(135deg, rgba(59,130,246,0.08), rgba(59,130,246,0.12))" }}>
                <Stack gap="xs">
                  <Text size="xs" c="dimmed" fw={600} tt="uppercase">Ticket Promedio</Text>
                  <Text fw={700} size="28px" c="blue">{summary.tickets > 0 ? formatCurrency(summary.total / summary.tickets) : "$0"}</Text>
                </Stack>
              </Paper>
              <Paper withBorder p="md" radius="lg" style={{ background: "linear-gradient(135deg, rgba(168,85,247,0.08), rgba(168,85,247,0.12))" }}>
                <Stack gap="xs">
                  <Text size="xs" c="dimmed" fw={600} tt="uppercase">Total Tickets</Text>
                  <Text fw={700} size="28px" c="violet">{summary.tickets}</Text>
                </Stack>
              </Paper>
            </SimpleGrid>
          </Paper>

          {/* Contenido principal en 2 columnas */}
          <Box p="lg" style={{ maxHeight: "50vh", overflow: "auto" }}>
            <Grid gutter="md">
              {/* Columna izquierda - Métodos de pago y Arqueo */}
              <Grid.Col span={5}>
                <Stack gap="md">
                  {/* Métodos de pago */}
                  <Card withBorder radius="lg" shadow="sm">
                    <Stack gap="sm">
                      <Text fw={700} size="sm" c="dimmed" tt="uppercase">Métodos de Pago</Text>
                      <Divider />
                      {Object.entries(summary.byPayment).map(([method, amount]) => {
                        const percentage = summary.total > 0 ? (amount / summary.total * 100).toFixed(0) : "0";
                        return (
                          <Group key={method} justify="space-between">
                            <Group gap="xs">
                              <Badge size="sm" variant="dot" color="indigo">{method.toUpperCase()}</Badge>
                              <Text size="sm" c="dimmed">{percentage}%</Text>
                            </Group>
                            <Text fw={700}>{formatCurrency(amount)}</Text>
                          </Group>
                        );
                      })}
                    </Stack>
                  </Card>

                  {/* Arqueo de caja */}
                  <Card withBorder radius="lg" shadow="sm">
                    <Stack gap="md">
                      <Text fw={700} size="sm" c="dimmed" tt="uppercase">Arqueo de Caja</Text>
                      <Divider />

                      <NumberInput
                        label="Efectivo Contado"
                        placeholder="Ingresa el monto contado"
                        value={cashCounted ?? undefined}
                        onChange={(value) => {
                          if (value === "" || value === null) {
                            setCashCounted(undefined);
                            return;
                          }
                          const parsed = typeof value === "number" ? value : Number(value);
                          setCashCounted(Number.isFinite(parsed) ? parsed : undefined);
                        }}
                        min={0}
                        thousandSeparator="."
                        decimalSeparator=","
                        size="md"
                      />

                      <Paper withBorder p="sm" radius="md" style={{ background: "rgba(99,102,241,0.05)" }}>
                        <Stack gap="xs">
                          <Group justify="space-between">
                            <Text size="sm" c="dimmed">Efectivo Esperado</Text>
                            <Text fw={600}>{formatCurrency(summary.cashExpected)}</Text>
                          </Group>
                          <Divider />
                          <Group justify="space-between">
                            <Text fw={600}>Diferencia</Text>
                            <Text
                              fw={700}
                              size="lg"
                              c={countedValue !== undefined && countedValue - summary.cashExpected !== 0
                                ? (countedValue - summary.cashExpected > 0 ? "teal" : "red")
                                : undefined}
                            >
                              {countedValue !== undefined
                                ? formatCurrency(countedValue - summary.cashExpected)
                                : "$0"}
                            </Text>
                          </Group>
                        </Stack>
                      </Paper>
                    </Stack>
                  </Card>
                </Stack>
              </Grid.Col>

              {/* Columna derecha - Productos vendidos */}
              <Grid.Col span={7}>
                <Card withBorder radius="lg" shadow="sm" style={{ height: "100%" }}>
                  <Stack gap="sm" style={{ height: "100%" }}>
                    <Group justify="space-between">
                      <Text fw={700} size="sm" c="dimmed" tt="uppercase">Productos Vendidos</Text>
                      <Badge variant="light" color="violet">{shiftProducts.length} productos</Badge>
                    </Group>
                    <Divider />

                    <Box style={{ flex: 1, overflow: "auto", maxHeight: "380px" }}>
                      <Table highlightOnHover withTableBorder>
                        <Table.Thead style={{ position: "sticky", top: 0, background: "white", zIndex: 1 }}>
                          <Table.Tr>
                            <Table.Th>Producto</Table.Th>
                            <Table.Th style={{ textAlign: "center" }}>Cant.</Table.Th>
                            <Table.Th style={{ textAlign: "right" }}>Total</Table.Th>
                          </Table.Tr>
                        </Table.Thead>
                        <Table.Tbody>
                          {shiftProducts.length === 0 ? (
                            <Table.Tr>
                              <Table.Td colSpan={3} style={{ textAlign: "center", padding: "2rem" }}>
                                <Text c="dimmed" size="sm">No hay productos vendidos</Text>
                              </Table.Td>
                            </Table.Tr>
                          ) : (
                            shiftProducts.map((product, index) => (
                              <Table.Tr key={index}>
                                <Table.Td>
                                  <Text size="sm" fw={500}>{product.name}</Text>
                                </Table.Td>
                                <Table.Td style={{ textAlign: "center" }}>
                                  <Badge size="md" variant="light" color="blue">
                                    {product.quantity}
                                  </Badge>
                                </Table.Td>
                                <Table.Td style={{ textAlign: "right" }}>
                                  <Text fw={600}>{formatCurrency(product.total)}</Text>
                                </Table.Td>
                              </Table.Tr>
                            ))
                          )}
                        </Table.Tbody>
                      </Table>
                    </Box>
                  </Stack>
                </Card>
              </Grid.Col>
            </Grid>
          </Box>

          {/* Footer con acciones */}
          <Paper p="lg" withBorder radius={0} style={{ background: "#f8f9fa", borderTop: "2px solid #e9ecef" }}>
            <Group justify="flex-end" gap="md">
              <Button
                variant="default"
                onClick={onClose}
              >
                Cancelar
              </Button>
              <Button
                color="teal"
                leftSection={<BadgeCheck size={18} />}
                onClick={() => {
                  if (countedValue === undefined) {
                    notifications.show({
                      title: "Campos incompletos",
                      message: "Ingresa el conteo final de efectivo para cerrar el turno.",
                      color: "orange"
                    });
                    return;
                  }
                  onCloseShift({ cashCounted: countedValue });
                }}
              >
                Confirmar Cierre de Turno
              </Button>
            </Group>
          </Paper>
        </Stack>
      </Modal>
    );
  }

  // Modal de apertura (sin cambios)
  return (
    <Modal opened={opened} onClose={onClose} title="Apertura de turno" centered size="lg">
      <Stack gap="lg">
        <TextInput
          label="Nombre del vendedor"
          placeholder="Ej: Matías R."
          value={seller}
          onChange={(event) => setSeller(event.currentTarget.value)}
        />
        <Select
          label="Turno"
          data={SHIFT_TYPES.map((item) => ({ value: item.value, label: item.label }))}
          value={shiftType}
          onChange={(value) => setShiftType((value as ShiftType) ?? "dia")}
        />
        <NumberInput
          label="Efectivo inicial"
          placeholder="Ej: 50000"
          description="Monto de efectivo con el que inicia el turno"
          value={initialCash ?? undefined}
          onChange={(value) => {
            if (value === "" || value === null) {
              setInitialCash(undefined);
              return;
            }
            const parsed = typeof value === "number" ? value : Number(value);
            setInitialCash(Number.isFinite(parsed) ? parsed : undefined);
          }}
          min={0}
          thousandSeparator="."
          decimalSeparator=","
        />
        <Badge color="teal" variant="light">
          Mantén el control en tiempo real del efectivo durante el turno.
        </Badge>
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            onClick={() => {
              if (!seller.trim()) {
                notifications.show({
                  title: "Campos incompletos",
                  message: "Ingresa el nombre del responsable del turno.",
                  color: "orange"
                });
                return;
              }
              const initialCashValue = typeof initialCash === "number" && Number.isFinite(initialCash) ? initialCash : undefined;
              if (initialCashValue === undefined) {
                notifications.show({
                  title: "Campos incompletos",
                  message: "Ingresa el efectivo inicial del turno.",
                  color: "orange"
                });
                return;
              }
              onOpenShift({ seller: seller.trim(), type: shiftType, initialCash: initialCashValue });
            }}
            leftSection={<Clock3 size={18} />}
          >
            Abrir turno
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
};

interface ClientModalProps {
  opened: boolean;
  onClose: () => void;
  onCreateClient: (payload: { name: string; limit: number; authorized: boolean }) => void;
}

const ClientModal = ({ opened, onClose, onCreateClient }: ClientModalProps) => {
  const [name, setName] = useState("");
  const [limit, setLimit] = useState<number | undefined>(undefined);
  const [authorized, setAuthorized] = useState(true);

  useEffect(() => {
    if (!opened) {
      setName("");
      setLimit(undefined);
      setAuthorized(true);
    }
  }, [opened]);

  if (!opened) return null;

  return (
    <Modal opened={opened} onClose={onClose} title="Nuevo cliente fiado" centered size="md">
      <Stack gap="lg">
        <TextInput
          label="Nombre del cliente"
          placeholder="Ej: Juan Pérez"
          value={name}
          onChange={(event) => setName(event.currentTarget.value)}
          required
        />
        <NumberInput
          label="Límite de crédito"
          placeholder="Ej: 100000"
          description="Monto máximo que el cliente puede deber"
          value={limit ?? undefined}
          onChange={(value) => {
            if (value === "" || value === null) {
              setLimit(undefined);
              return;
            }
            const parsed = typeof value === "number" ? value : Number(value);
            setLimit(Number.isFinite(parsed) ? parsed : undefined);
          }}
          min={0}
          thousandSeparator="."
          decimalSeparator=","
          required
        />
        <Switch
          label="Autorizar al cliente"
          description="Si está autorizado, podrá realizar compras a crédito inmediatamente"
          checked={authorized}
          onChange={(event) => setAuthorized(event.currentTarget.checked)}
        />
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            onClick={() => {
              if (!name.trim()) {
                notifications.show({
                  title: "Campos incompletos",
                  message: "Ingresa el nombre del cliente.",
                  color: "orange"
                });
                return;
              }
              const limitValue = typeof limit === "number" && Number.isFinite(limit) ? limit : undefined;
              if (limitValue === undefined) {
                notifications.show({
                  title: "Campos incompletos",
                  message: "Ingresa el límite de crédito.",
                  color: "orange"
                });
                return;
              }
              onCreateClient({ name: name.trim(), limit: limitValue, authorized });
            }}
            leftSection={<UserPlus size={18} />}
          >
            Crear cliente
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
};

interface AddStockModalProps {
  opened: boolean;
  onClose: () => void;
  products: Product[];
  selectedProductId: string | null;
  onConfirm: (productId: string, quantity: number, reason: string) => void;
}

const AddStockModal = ({ opened, onClose, products, selectedProductId, onConfirm }: AddStockModalProps) => {
  const [productId, setProductId] = useState<string | null>(selectedProductId);
  const [quantity, setQuantity] = useState<number | undefined>(undefined);
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (opened) {
      setProductId(selectedProductId);
      setQuantity(undefined);
      setReason("");
    }
  }, [opened, selectedProductId]);

  const selectedProduct = products.find((p) => p.id === productId);

  return (
    <Modal opened={opened} onClose={onClose} title="Agregar stock" centered size="md">
      <Stack gap="lg">
        <Select
          label="Producto"
          placeholder="Selecciona un producto"
          data={products.map((p) => ({ value: p.id, label: `${p.name} - ${p.category}` }))}
          value={productId}
          onChange={setProductId}
          searchable
        />
        {selectedProduct && (
          <Paper withBorder p="sm" radius="md" style={{ background: "rgba(59,130,246,0.05)" }}>
            <Stack gap={4}>
              <Text size="sm" fw={600}>{selectedProduct.name}</Text>
              <Text size="xs" c="dimmed">Stock actual: {selectedProduct.stock} unidades</Text>
            </Stack>
          </Paper>
        )}
        <NumberInput
          label="Cantidad a agregar"
          placeholder="Ej: 50"
          value={quantity ?? undefined}
          onChange={(value) => {
            if (value === "" || value === null) {
              setQuantity(undefined);
              return;
            }
            const parsed = typeof value === "number" ? value : Number(value);
            setQuantity(Number.isFinite(parsed) && parsed > 0 ? parsed : undefined);
          }}
          min={1}
        />
        <Select
          label="Motivo"
          placeholder="Selecciona el motivo"
          data={[
            { value: "entrada", label: "Entrada de mercancía" },
            { value: "devolucion", label: "Devolución de cliente" },
            { value: "ajuste", label: "Ajuste de inventario" },
            { value: "otro", label: "Otro" }
          ]}
          value={reason}
          onChange={(val) => setReason(val ?? "")}
        />
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            onClick={() => {
              if (!productId) {
                notifications.show({
                  title: "Producto requerido",
                  message: "Selecciona un producto",
                  color: "orange"
                });
                return;
              }
              if (!quantity || quantity <= 0) {
                notifications.show({
                  title: "Cantidad inválida",
                  message: "Ingresa una cantidad válida",
                  color: "orange"
                });
                return;
              }
              if (!reason) {
                notifications.show({
                  title: "Motivo requerido",
                  message: "Selecciona el motivo",
                  color: "orange"
                });
                return;
              }
              onConfirm(productId, quantity, reason);
            }}
            leftSection={<Plus size={18} />}
          >
            Agregar stock
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
};

interface EditProductModalProps {
  opened: boolean;
  onClose: () => void;
  product: Product | null;
  categories: string[];
  onSave: (productId: string | null, updates: Partial<Product>) => void;
}

const EditProductModal = ({ opened, onClose, product, categories, onSave }: EditProductModalProps) => {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [barcode, setBarcode] = useState("");
  const [price, setPrice] = useState<number | undefined>(undefined);
  const [stock, setStock] = useState<number | undefined>(undefined);
  const [minStock, setMinStock] = useState<number | undefined>(undefined);

  useEffect(() => {
    if (opened) {
      if (product) {
        setName(product.name);
        setCategory(product.category);
        setBarcode(product.barcode ?? "");
        setPrice(product.price);
        setStock(product.stock);
        setMinStock(product.minStock);
      } else {
        // Resetear campos para nuevo producto
        setName("");
        setCategory("");
        setBarcode("");
        setPrice(undefined);
        setStock(undefined);
        setMinStock(5);
      }
    }
  }, [opened, product]);

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={product ? "Editar producto" : "Nuevo producto"}
      centered
      size="lg"
    >
      <Stack gap="lg">
        <TextInput
          label="Nombre"
          placeholder="Ej: Yogurt natural 1L"
          value={name}
          onChange={(e) => setName(e.currentTarget.value)}
        />
        <Autocomplete
          label="Categoría"
          placeholder="Selecciona o escribe una categoría"
          data={categories}
          value={category}
          onChange={setCategory}
        />
        <TextInput
          label="Código de barras"
          placeholder="Opcional"
          value={barcode}
          onChange={(e) => setBarcode(e.currentTarget.value)}
        />
        <NumberInput
          label="Precio"
          placeholder="CLP"
          value={price ?? undefined}
          onChange={(value) => {
            if (value === "" || value === null) {
              setPrice(undefined);
              return;
            }
            const parsed = typeof value === "number" ? value : Number(value);
            setPrice(Number.isFinite(parsed) ? parsed : undefined);
          }}
          thousandSeparator="."
          decimalSeparator=","
          min={0}
        />
        <Grid gutter="md">
          <Grid.Col span={6}>
            <NumberInput
              label="Stock inicial"
              placeholder="Cantidad en inventario"
              value={stock ?? undefined}
              onChange={(value) => {
                if (value === "" || value === null) {
                  setStock(undefined);
                  return;
                }
                const parsed = typeof value === "number" ? value : Number(value);
                setStock(Number.isFinite(parsed) ? parsed : undefined);
              }}
              min={0}
            />
          </Grid.Col>
          <Grid.Col span={6}>
            <NumberInput
              label="Stock mínimo"
              placeholder="Cantidad mínima de alerta"
              value={minStock ?? undefined}
              onChange={(value) => {
                if (value === "" || value === null) {
                  setMinStock(undefined);
                  return;
                }
                const parsed = typeof value === "number" ? value : Number(value);
                setMinStock(Number.isFinite(parsed) ? parsed : undefined);
              }}
              min={0}
            />
          </Grid.Col>
        </Grid>
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            onClick={() => {
              if (!name.trim()) {
                notifications.show({
                  title: "Nombre requerido",
                  message: "Ingresa el nombre del producto",
                  color: "orange"
                });
                return;
              }
              if (!category.trim()) {
                notifications.show({
                  title: "Categoría requerida",
                  message: "Ingresa la categoría",
                  color: "orange"
                });
                return;
              }
              if (price === undefined || price <= 0) {
                notifications.show({
                  title: "Precio inválido",
                  message: "Ingresa un precio válido",
                  color: "orange"
                });
                return;
              }
              onSave(product?.id ?? null, {
                name: name.trim(),
                category: category.trim(),
                barcode: barcode.trim() || null,
                price,
                stock: stock ?? 0,
                minStock: minStock ?? 5
              });
              onClose();
            }}
            leftSection={product ? <Edit size={18} /> : <Plus size={18} />}
          >
            {product ? "Guardar cambios" : "Crear producto"}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
};

interface DeleteProductModalProps {
  opened: boolean;
  product: Product | null;
  onClose: () => void;
  onConfirm: (productId: string) => void;
}

const DeleteProductModal = ({ opened, product, onClose, onConfirm }: DeleteProductModalProps) => (
  <Modal opened={opened} onClose={onClose} title="Eliminar producto" centered size="sm">
    <Stack gap="md">
      <Text>
        Esta acción eliminará{" "}
        <Text span fw={700}>
          {product?.name ?? "este producto"}
        </Text>{" "}
        del inventario y no se puede deshacer.
      </Text>
      {product && (
        <Paper withBorder radius="md" p="sm">
          <Stack gap={4}>
            <Text size="sm" fw={600}>
              {product.category}
            </Text>
            <Text size="xs" c="dimmed">
              Stock actual: {product.stock} • {formatCurrency(product.price)}
            </Text>
          </Stack>
        </Paper>
      )}
      <Group justify="flex-end">
        <Button variant="default" onClick={onClose}>
          Cancelar
        </Button>
        <Button
          color="red"
          leftSection={<Trash2 size={18} />}
          onClick={() => {
            if (!product) return;
            onConfirm(product.id);
          }}
        >
          Eliminar
        </Button>
      </Group>
    </Stack>
  </Modal>
);

interface ReturnDrawerProps {
  opened: boolean;
  sales: Sale[];
  value: string | null;
  onClose: () => void;
  onSelectSale: (saleId: string | null) => void;
  items: Record<string, number>;
  onChangeItem: (itemId: string, quantity: number) => void;
  reason: string;
  onChangeReason: (value: string) => void;
  refundMethod: "cash" | "card" | "product";
  onChangeRefundMethod: (value: "cash" | "card" | "product") => void;
  onConfirm: () => void;
}

const ReturnDrawer = ({
  opened,
  sales,
  value,
  onClose,
  onSelectSale,
  items,
  onChangeItem,
  reason,
  onChangeReason,
  refundMethod,
  onChangeRefundMethod,
  onConfirm
}: ReturnDrawerProps) => {
  const selectedSale = sales.find((sale) => sale.id === value);
  const totalReturn = selectedSale
    ? selectedSale.items.reduce((acc, item) => acc + (items[item.id] ?? 0) * item.price, 0)
    : 0;

  return (
    <Drawer opened={opened} onClose={onClose} title="Gestionar devolución" position="right" size="lg">
      <Stack gap="lg">
        <Select
          label="Selecciona la venta"
          placeholder="Busca por ticket"
          searchable
          data={sales.map((sale) => ({
            value: sale.id,
            label: `#${sale.ticket} • ${formatDateTime(sale.created_at)} • ${formatCurrency(sale.total)}`
          }))}
          value={value}
          onChange={(val) => onSelectSale(val)}
        />
        {selectedSale ? (
          <Stack gap="md">
            <Text fw={600}>Productos vendidos</Text>
            <Stack gap="sm">
              {selectedSale.items.map((item) => (
                <Paper withBorder p="md" radius="md" key={item.id}>
                  <Group justify="space-between" align="center">
                    <div>
                      <Text fw={600}>{item.name}</Text>
                      <Text size="sm" c="dimmed">
                        Vendido: {item.quantity} • {formatCurrency(item.price)}
                      </Text>
                    </div>
                    <NumberInput
                      size="sm"
                      style={{ width: 140 }}
                      min={0}
                      max={item.quantity}
                      value={items[item.id] ?? 0}
                      onChange={(value) => onChangeItem(item.id, Number(value))}
                    />
                  </Group>
                </Paper>
              ))}
            </Stack>
            <TextInput
              label="Motivo"
              placeholder="Producto en mal estado, vencido, error de cobro..."
              value={reason}
              onChange={(event) => onChangeReason(event.currentTarget.value)}
            />
            <Select
              label="Método de devolución"
              description="Selecciona cómo se devolverá el dinero al cliente"
              value={refundMethod}
              onChange={(val) => onChangeRefundMethod(val as "cash" | "card" | "product")}
              data={[
                { value: "cash", label: "Efectivo" },
                { value: "card", label: "Tarjeta" },
                { value: "product", label: "Cambio por producto" }
              ]}
            />
            <Paper withBorder p="md" radius="md">
              <Group justify="space-between">
                <Text>Total a devolver</Text>
                <Text fw={700}>{formatCurrency(totalReturn)}</Text>
              </Group>
            </Paper>
            <Button
              color="red"
              leftSection={<Receipt size={18} />}
              onClick={() => {
                if (totalReturn <= 0) {
                  notifications.show({
                    title: "Sin cambios",
                    message: "Selecciona al menos un producto a devolver.",
                    color: "orange"
                  });
                  return;
                }
                onConfirm();
              }}
            >
              Registrar devolución
            </Button>
          </Stack>
        ) : (
          <Paper withBorder radius="md" p="lg">
            <Text c="dimmed">Selecciona una venta para gestionar la devolución.</Text>
          </Paper>
        )}
      </Stack>
    </Drawer>
  );
};

interface PaymentEditModalProps {
  sale: Sale | null;
  opened: boolean;
  onClose: () => void;
  onSave: (method: PaymentMethod) => void;
}

const PaymentEditModal = ({ sale, opened, onClose, onSave }: PaymentEditModalProps) => {
  const [method, setMethod] = useState<PaymentMethod>("cash");

  useEffect(() => {
    if (sale) {
      setMethod(sale.paymentMethod);
    }
  }, [sale]);

  if (!sale) return null;

  return (
    <Modal opened={opened} onClose={onClose} title="Cambiar método de pago" centered>
      <Stack>
        <Text>
          Ticket #{sale.ticket} • {formatCurrency(sale.total)}
        </Text>
        <Select
          label="Nuevo método"
          value={method}
          onChange={(value) => setMethod((value as PaymentMethod) ?? "cash")}
          data={PAYMENT_OPTIONS.map((option) => ({
            value: option.id,
            label: option.label
          }))}
        />
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            leftSection={<RefreshCcw size={18} />}
            onClick={() => onSave(method)}
          >
            Guardar cambios
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
};

interface FiadoPaymentModalProps {
  opened: boolean;
  client: Client | null;
  mode: "abono" | "total";
  onClose: () => void;
  onSubmit: (payload: { amount: number; description: string }) => void;
}

const FiadoPaymentModal = ({ opened, client, mode, onClose, onSubmit }: FiadoPaymentModalProps) => {
  const [amount, setAmount] = useState<number | undefined>(undefined);
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (opened) {
      setAmount(mode === "total" ? client?.balance ?? 0 : undefined);
      setDescription("");
    }
  }, [opened, client, mode]);

  if (!client) return null;

  const maxAmount = client.balance;

  return (
    <Modal opened={opened} onClose={onClose} title="Gestión de fiados" centered>
      <Stack>
        <Text fw={600}>{client.name}</Text>
        <Text c="dimmed">Saldo actual: {formatCurrency(client.balance)}</Text>
        <NumberInput
          label={mode === "total" ? "Monto a cancelar" : "Monto del abono"}
          min={0}
          max={maxAmount}
          value={amount ?? undefined}
          onChange={(value) => {
            if (value === "" || value === null) {
              setAmount(undefined);
              return;
            }
            const parsed = typeof value === "number" ? value : Number(value);
            setAmount(Number.isFinite(parsed) ? parsed : undefined);
          }}
          thousandSeparator="."
          decimalSeparator=","
        />
        {mode === "abono" && (
          <TextInput
            label="Glosa"
            placeholder="Detalle del abono"
            value={description}
            onChange={(event) => setDescription(event.currentTarget.value)}
          />
        )}
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            leftSection={<PiggyBank size={18} />}
            onClick={() => {
              if (amount === undefined || amount <= 0) {
                notifications.show({
                  title: "Monto inválido",
                  message: "Ingresa un monto válido para registrar el movimiento.",
                  color: "orange"
                });
                return;
              }
              if (amount > client.balance) {
                notifications.show({
                  title: "Excede el saldo",
                  message: "El monto supera el saldo actual del cliente.",
                  color: "red"
                });
                return;
              }
              onSubmit({ amount, description: description.trim() });
            }}
          >
            Registrar
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
};

interface LowStockModalProps {
  opened: boolean;
  onClose: () => void;
  products: Product[];
}

const LowStockModal = ({ opened, onClose, products }: LowStockModalProps) => {
  const lowStockProducts = products.filter((p) => p.stock <= p.minStock);

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Productos con Stock Crítico"
      size="xl"
      centered
    >
      <Stack gap="lg">
        <Paper withBorder p="md" radius="md" style={{ background: "linear-gradient(135deg, rgba(251,191,36,0.1), rgba(251,146,60,0.15))" }}>
          <Group justify="space-between" align="center">
            <Group gap="md">
              <ThemeIcon size="lg" variant="gradient" gradient={{ from: "orange", to: "yellow" }} radius="md">
                <AlertTriangle size={24} />
              </ThemeIcon>
              <Stack gap={2}>
                <Text fw={700} size="lg">
                  {lowStockProducts.length} producto{lowStockProducts.length !== 1 ? "s" : ""} requieren atención
                </Text>
                <Text size="sm" c="dimmed">
                  Estos productos están por debajo del stock mínimo establecido
                </Text>
              </Stack>
            </Group>
            <Badge size="xl" color="orange" variant="filled">
              Prioridad Alta
            </Badge>
          </Group>
        </Paper>

        {lowStockProducts.length === 0 ? (
          <Paper withBorder p="xl" radius="lg">
            <Stack align="center" gap="md">
              <ThemeIcon size={80} radius="xl" variant="light" color="teal">
                <BadgeCheck size={50} />
              </ThemeIcon>
              <Text fw={600} size="lg" c="dimmed" ta="center">
                ¡Excelente! Todo el inventario está bajo control
              </Text>
              <Text size="sm" c="dimmed" ta="center">
                No hay productos que requieran reposición en este momento
              </Text>
            </Stack>
          </Paper>
        ) : (
          <ScrollArea h={450}>
            <Table striped highlightOnHover withTableBorder withColumnBorders>
              <Table.Thead>
                <Table.Tr style={{ background: "linear-gradient(135deg, rgba(99,102,241,0.08), rgba(59,130,246,0.12))" }}>
                  <Table.Th style={{ fontWeight: 700 }}>Producto</Table.Th>
                  <Table.Th style={{ fontWeight: 700 }}>Categoría</Table.Th>
                  <Table.Th style={{ fontWeight: 700, textAlign: "center" }}>Stock Actual</Table.Th>
                  <Table.Th style={{ fontWeight: 700, textAlign: "center" }}>Mínimo</Table.Th>
                  <Table.Th style={{ fontWeight: 700, textAlign: "center" }}>Faltan</Table.Th>
                  <Table.Th style={{ fontWeight: 700, textAlign: "center" }}>Estado</Table.Th>
                  <Table.Th style={{ fontWeight: 700, textAlign: "right" }}>Precio</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {lowStockProducts.map((product) => {
                  const deficit = product.minStock - product.stock;
                  const isOutOfStock = product.stock === 0;

                  return (
                    <Table.Tr key={product.id} style={{ background: isOutOfStock ? "rgba(239, 68, 68, 0.05)" : undefined }}>
                      <Table.Td>
                        <Text fw={600} c={isOutOfStock ? "red" : "dark"}>
                          {product.name}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Badge variant="light" color="indigo" size="sm">
                          {product.category}
                        </Badge>
                      </Table.Td>
                      <Table.Td style={{ textAlign: "center" }}>
                        <Text fw={700} c={isOutOfStock ? "red" : "orange"} size="lg">
                          {product.stock}
                        </Text>
                      </Table.Td>
                      <Table.Td style={{ textAlign: "center" }}>
                        <Text c="dimmed">{product.minStock}</Text>
                      </Table.Td>
                      <Table.Td style={{ textAlign: "center" }}>
                        <Badge color={isOutOfStock ? "red" : "orange"} variant="filled">
                          {deficit > 0 ? `+${deficit}` : deficit}
                        </Badge>
                      </Table.Td>
                      <Table.Td style={{ textAlign: "center" }}>
                        <Badge
                          color={isOutOfStock ? "red" : "orange"}
                          variant="dot"
                          size="lg"
                        >
                          {isOutOfStock ? "Sin stock" : "Bajo"}
                        </Badge>
                      </Table.Td>
                      <Table.Td style={{ textAlign: "right" }}>
                        <Text fw={600}>{formatCurrency(product.price)}</Text>
                      </Table.Td>
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>
            </Table>
          </ScrollArea>
        )}

        <Group justify="flex-end">
          <Button variant="light" color="gray" onClick={onClose}>
            Cerrar
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
};

const App = () => {
  const queryClient = useQueryClient();
  const isMobile = useMediaQuery("(max-width: 768px)");
  const { colorScheme, setColorScheme } = useMantineColorScheme();

  const [activeTab, setActiveTab] = useState<TabId>("dashboard");
  const [userRole, setUserRole] = useState<Role | null>(null);
  const [pendingTab, setPendingTab] = useState<TabId | null>(null);
  const [passwordModalOpened, passwordModalHandlers] = useDisclosure(false);

  // Función para verificar si el usuario tiene acceso a una pestaña
  const hasAccess = (tab: TabConfig): boolean => {
    if (!tab.requiredRole) return true; // Sin restricción
    if (!userRole) return false; // No autenticado

    // admin tiene acceso a todo
    if (userRole === "admin") return true;

    // manager solo tiene acceso a pestañas con requiredRole === "manager"
    if (userRole === "manager" && tab.requiredRole === "manager") return true;

    return false;
  };

  const [cart, setCart] = useState<CartLine[]>([]);
  const [search, setSearch] = useState("");
  const [posCategoryFilter, setPosCategoryFilter] = useState<string | null>(null);
  const [selectedPayment, setSelectedPayment] = useState<PaymentMethod>("cash");
  const [cashReceived, setCashReceived] = useState<number | undefined>(undefined);
  const [selectedFiadoClient, setSelectedFiadoClient] = useState<string | null>(null);
  const [customerDisplay, setCustomerDisplay] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const [shiftModalOpened, shiftModalHandlers] = useDisclosure(false);
  const [shiftModalMode, setShiftModalMode] = useState<"open" | "close">("open");

  const [lowStockModalOpened, lowStockModalHandlers] = useDisclosure(false);

  const [returnDrawerOpened, returnDrawerHandlers] = useDisclosure(false);
  const [returnSaleId, setReturnSaleId] = useState<string | null>(null);
  const [returnItems, setReturnItems] = useState<Record<string, number>>({});
  const [returnReason, setReturnReason] = useState("");
  const [returnRefundMethod, setReturnRefundMethod] = useState<"cash" | "card" | "product">("cash");

  const [paymentEditSaleId, setPaymentEditSaleId] = useState<string | null>(null);

  const [fiadoModalOpened, fiadoModalHandlers] = useDisclosure(false);
  const [fiadoModalClientId, setFiadoModalClientId] = useState<string | null>(null);
  const [fiadoModalMode, setFiadoModalMode] = useState<"abono" | "total">("abono");

  const [clientModalOpened, clientModalHandlers] = useDisclosure(false);

  // Inventory states
  const [inventorySearch, setInventorySearch] = useState("");
  const [inventoryCategoryFilter, setInventoryCategoryFilter] = useState<string | null>(null);
  const [inventoryStockFilter, setInventoryStockFilter] = useState<"all" | "low" | "out">("all");
  const [addStockModalOpened, addStockModalHandlers] = useDisclosure(false);
  const [editProductModalOpened, editProductModalHandlers] = useDisclosure(false);
  const [selectedProductForStock, setSelectedProductForStock] = useState<string | null>(null);
  const [selectedProductForEdit, setSelectedProductForEdit] = useState<Product | null>(null);
  const [deleteProductModalOpened, deleteProductModalHandlers] = useDisclosure(false);
  const [selectedProductForDelete, setSelectedProductForDelete] = useState<Product | null>(null);

  const [reportFilters, setReportFilters] = useState<ReportFilters>({ range: "today" });
  const [now, setNow] = useState(dayjs());

  useEffect(() => {
    const interval = window.setInterval(() => setNow(dayjs()), 60000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (userRole && pendingTab) {
      setActiveTab(pendingTab);
      setPendingTab(null);
    }
  }, [userRole, pendingTab]);

  const productQuery = useQuery({
    queryKey: ["products"],
    queryFn: fetchProducts,
    initialData: FALLBACK_PRODUCTS
  });

  const clientsQuery = useQuery({
    queryKey: ["clients"],
    queryFn: fetchClients,
    initialData: FALLBACK_CLIENTS
  });

  const salesQuery = useQuery({
    queryKey: ["sales"],
    queryFn: fetchSales,
    initialData: FALLBACK_SALES
  });

  const shiftsQuery = useQuery({
    queryKey: ["shifts"],
    queryFn: fetchShifts,
    initialData: FALLBACK_SHIFTS
  });

  const products = productQuery.data ?? [];
  const clients = clientsQuery.data ?? [];
  const sales = salesQuery.data ?? [];
  const shifts = shiftsQuery.data ?? [];
  const activeShift = useMemo(() => shifts.find((shift) => shift.status === "open"), [shifts]);
  const shiftSummary = useMemo(() => computeShiftSummary(sales, activeShift?.id ?? null), [sales, activeShift]);

  const productMap = useMemo(() => new Map(products.map((product) => [product.id, product])), [products]);
  const cartDetailed = useMemo(() => {
    return cart
      .map((line) => {
        const product = productMap.get(line.productId);
        if (!product) return null;
        return {
          product,
          quantity: line.quantity,
          subtotal: product.price * line.quantity
        };
      })
      .filter(Boolean) as { product: Product; quantity: number; subtotal: number }[];
  }, [cart, productMap]);

  const cartTotals = useMemo(() => {
    const total = cartDetailed.reduce((acc, item) => acc + item.subtotal, 0);
    const items = cartDetailed.reduce((acc, item) => acc + item.quantity, 0);
    const cashValue =
      selectedPayment === "cash" && typeof cashReceived === "number" && Number.isFinite(cashReceived)
        ? cashReceived
        : undefined;
    const change = cashValue !== undefined ? cashValue - total : 0;
    return { total, items, change };
  }, [cartDetailed, selectedPayment, cashReceived]);

  const paymentOption = PAYMENT_OPTIONS.find((option) => option.id === selectedPayment);

  // Calcular cantidad vendida por producto
  const productSalesCount = useMemo(() => {
    const salesMap = new Map<string, number>();
    sales.forEach((sale) => {
      if (sale.type === "sale") {
        sale.items.forEach((item) => {
          const current = salesMap.get(item.productId) || 0;
          salesMap.set(item.productId, current + item.quantity);
        });
      }
    });
    return salesMap;
  }, [sales]);

  // Obtener categorías únicas ordenadas alfabéticamente
  const uniqueCategories = useMemo(() => {
    const categories = new Set(products.map((p) => p.category));
    return Array.from(categories).sort();
  }, [products]);

  const filteredProducts = useMemo(() => {
    let filtered = products;

    // Filtrar por categoría si hay una seleccionada
    if (posCategoryFilter) {
      filtered = filtered.filter((product) => product.category === posCategoryFilter);
    }

    // Filtrar por búsqueda si hay término
    if (search.trim()) {
      const term = search.toLowerCase();
      filtered = filtered.filter(
        (product) =>
          product.name.toLowerCase().includes(term) ||
          product.category.toLowerCase().includes(term) ||
          (product.barcode && product.barcode.includes(term))
      );
    }

    // Ordenar por cantidad vendida (mayor a menor)
    return [...filtered].sort((a, b) => {
      const salesA = productSalesCount.get(a.id) || 0;
      const salesB = productSalesCount.get(b.id) || 0;
      return salesB - salesA;
    });
  }, [products, search, posCategoryFilter, productSalesCount]);

  const lowStockProducts = useMemo(() => products.filter((product) => product.stock <= product.minStock), [products]);

  const autoCompleteData = useMemo(() => products.map((product) => product.name), [products]);

  const guardTabChange = (tab: TabId) => {
    const target = TABS.find((item) => item.id === tab);
    if (!target) return;

    if (!hasAccess(target)) {
      setPendingTab(tab);
      passwordModalHandlers.open();
      return;
    }
    setActiveTab(tab);
  };

  const handleLockAdmin = () => {
    setUserRole(null);
    setPendingTab(null);
    setActiveTab("dashboard");
    notifications.show({
      title: "Sesión cerrada",
      message: "Las secciones administrativas quedaron bloqueadas.",
      color: "blue"
    });
  };

  const handleSelectPayment = (paymentId: PaymentMethod) => {
    setSelectedPayment(paymentId);
    if (paymentId !== "cash") {
      setCashReceived(undefined);
    }
    if (paymentId !== "fiado") {
      setSelectedFiadoClient(null);
    }
  };

  const handleAddProductToCart = useCallback(
    (productId: string) => {
      const product = productMap.get(productId);
      if (!product) return;

      setCart((prev) => {
        const existing = prev.find((item) => item.productId === productId);
        const newQuantity = (existing?.quantity ?? 0) + 1;
        if (newQuantity > product.stock) {
          notifications.show({
            title: "Stock insuficiente",
            message: `No quedan unidades suficientes de ${product.name}.`,
            color: "red"
          });
          return prev;
        }
        if (existing) {
          return prev.map((item) =>
            item.productId === productId ? { ...item, quantity: item.quantity + 1 } : item
          );
        }
        return [...prev, { productId, quantity: 1 }];
      });

      notifications.show({
        title: "Producto agregado",
        message: `${product.name} se agregó al carrito.`,
        color: "teal"
      });
    },
    [productMap]
  );

  // Detector ROBUSTO de escaneo de códigos de barras con pistola lectora
  // Compatible con cualquier dispositivo y navegador
  useEffect(() => {
    if (activeTab !== "pos") return;

    let barcodeBuffer = "";
    let lastKeyTime = 0;
    let resetTimeout: NodeJS.Timeout | null = null;
    let isScanning = false;
    let keyTimes: number[] = [];

    const processBarcode = (code: string) => {
      const trimmedCode = code.trim();

      console.log("═══════════════════════════════════════");
      console.log("🔍 CÓDIGO ESCANEADO:", trimmedCode);
      console.log("📏 Longitud:", trimmedCode.length, "caracteres");
      console.log("═══════════════════════════════════════");

      if (trimmedCode.length === 0) return;

      // Buscar producto por código de barras
      const product = products.find((p) => p.barcode === trimmedCode);

      if (product) {
        console.log("✅ PRODUCTO ENCONTRADO:", product.name);
        console.log("💰 Precio:", product.price);
        handleAddProductToCart(product.id);

        notifications.show({
          title: "✅ Producto escaneado",
          message: `${product.name} agregado al carrito`,
          color: "teal",
          autoClose: 2000
        });
      } else {
        console.log("❌ PRODUCTO NO ENCONTRADO");
        console.log("📋 Códigos disponibles:", products.map(p => p.barcode).filter(Boolean).join(", "));
        notifications.show({
          title: "⚠️ Código no encontrado",
          message: `Código: ${trimmedCode}`,
          color: "orange",
          autoClose: 3000
        });
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      const currentTime = Date.now();
      const timeDiff = lastKeyTime > 0 ? currentTime - lastKeyTime : 1000;

      // Ignorar teclas modificadoras
      if (event.ctrlKey || event.altKey || event.metaKey) return;

      // Si es Enter, procesar el código escaneado
      if (event.key === "Enter" || event.keyCode === 13 || event.code === "Enter") {
        if (resetTimeout) {
          clearTimeout(resetTimeout);
          resetTimeout = null;
        }

        const scannedCode = barcodeBuffer.trim();

        // Calcular velocidad promedio de teclas
        const avgSpeed = keyTimes.length > 1
          ? keyTimes.reduce((acc, val, idx, arr) => {
              if (idx === 0) return 0;
              return acc + (val - arr[idx - 1]);
            }, 0) / (keyTimes.length - 1)
          : 0;

        console.log("⏱️ Velocidad promedio:", avgSpeed.toFixed(2), "ms");
        console.log("📊 Buffer completo:", scannedCode, "| Longitud:", scannedCode.length);
        console.log("🎯 Es escaneo:", isScanning);

        // Procesar si el buffer tiene al menos 3 caracteres (código de barras mínimo)
        if (scannedCode.length >= 3) {
          // Prevenir submit de formularios
          event.preventDefault();
          event.stopPropagation();

          // Limpiar cualquier input que pueda tener el foco
          if (document.activeElement instanceof HTMLInputElement ||
              document.activeElement instanceof HTMLTextAreaElement) {
            document.activeElement.blur();
          }

          processBarcode(scannedCode);
        }

        barcodeBuffer = "";
        isScanning = false;
        lastKeyTime = 0;
        keyTimes = [];
        return;
      }

      // Solo procesar caracteres imprimibles (ignorar teclas especiales)
      if (event.key.length > 1) return;

      const char = event.key;
      if (!char || char.length !== 1) return;

      // Verificar si el usuario está escribiendo en un input
      const activeElement = document.activeElement;
      const isTypingInInput = activeElement instanceof HTMLInputElement ||
                              activeElement instanceof HTMLTextAreaElement;

      // Limpiar timeout anterior
      if (resetTimeout) {
        clearTimeout(resetTimeout);
        resetTimeout = null;
      }

      // Si pasa más de 300ms entre teclas, reiniciar buffer (escritura manual lenta)
      if (timeDiff > 300 && barcodeBuffer.length > 0) {
        console.log("⏱️ Reset por tiempo lento - Buffer anterior:", barcodeBuffer);
        barcodeBuffer = "";
        isScanning = false;
        keyTimes = [];
      }

      // Detectar si es un escaneo de pistola (teclas SÚPER rápidas < 40ms)
      // Las pistolas envían caracteres en < 30ms típicamente
      const isBarcodeScanner = timeDiff < 40;

      if (isBarcodeScanner) {
        isScanning = true;
      }

      // LÓGICA DE PREVENCIÓN MEJORADA:
      // 1. Si NO está en input Y hay buffer → prevenir (escaneo sin foco)
      // 2. Si está en input pero teclas SÚPER rápidas → prevenir (pistola)
      // 3. Si está en input y teclas normales → permitir (escritura manual)
      let shouldPrevent = false;

      if (!isTypingInInput && barcodeBuffer.length > 0) {
        // No está escribiendo en input, es un escaneo sin foco
        shouldPrevent = true;
      } else if (isTypingInInput && isBarcodeScanner) {
        // Está en input pero las teclas vienen a velocidad de pistola
        shouldPrevent = true;
      }

      if (shouldPrevent) {
        event.preventDefault();
        event.stopPropagation();
      }

      // Agregar al buffer solo si es escaneo detectado
      if (isBarcodeScanner || (!isTypingInInput && barcodeBuffer.length === 0)) {
        barcodeBuffer += char;
        keyTimes.push(currentTime);
        console.log("⌨️", char, "| Buffer:", barcodeBuffer, "| Tiempo:", timeDiff.toFixed(0), "ms | Pistola:", isBarcodeScanner);
      } else if (!isTypingInInput && barcodeBuffer.length > 0) {
        // Continuación de escaneo sin input
        barcodeBuffer += char;
        keyTimes.push(currentTime);
        console.log("⌨️", char, "| Buffer:", barcodeBuffer, "| Tiempo:", timeDiff.toFixed(0), "ms");
      }

      lastKeyTime = currentTime;

      // Auto-reset después de 500ms de inactividad
      resetTimeout = setTimeout(() => {
        if (barcodeBuffer.length > 0) {
          console.log("⏰ TIMEOUT - Reseteando buffer:", barcodeBuffer);
        }
        barcodeBuffer = "";
        isScanning = false;
        lastKeyTime = 0;
        keyTimes = [];
      }, 500);
    };

    // Escuchar en document para capturar TODOS los eventos
    // useCapture = true para interceptar antes que otros handlers
    document.addEventListener("keydown", handleKeyDown, true);

    console.log("🚀 Detector de código de barras ACTIVADO");
    console.log("📱 Compatible con cualquier dispositivo y navegador");

    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);
      if (resetTimeout) {
        clearTimeout(resetTimeout);
      }
      console.log("🛑 Detector de código de barras DESACTIVADO");
    };
  }, [activeTab, products, handleAddProductToCart]);

  const handleUpdateCartQuantity = (productId: string, quantity: number) => {
    const product = productMap.get(productId);
    if (!product) return;
    if (quantity <= 0) {
      setCart((prev) => prev.filter((item) => item.productId !== productId));
      return;
    }
    if (quantity > product.stock) {
      notifications.show({
        title: "Sin stock",
        message: "No hay stock suficiente para la cantidad seleccionada.",
        color: "red"
      });
      return;
    }
    setCart((prev) =>
      prev.map((item) => (item.productId === productId ? { ...item, quantity } : item))
    );
  };

  const handleRemoveCartItem = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.productId !== productId));
  };

  const validateSale = () => {
    if (cartDetailed.length === 0) {
      notifications.show({
        title: "Carrito vacío",
        message: "Agrega productos antes de generar la venta.",
        color: "red"
      });
      return false;
    }

    // VALIDACIÓN CRÍTICA: NO permitir ventas sin turno abierto
    if (!activeShift) {
      notifications.show({
        title: "Turno cerrado",
        message: "Debes abrir un turno antes de registrar ventas.",
        color: "red",
        autoClose: false
      });
      return false;
    }

    if (selectedPayment === "cash") {
      const cashValue = typeof cashReceived === "number" && Number.isFinite(cashReceived) ? cashReceived : undefined;
      if (cashValue === undefined || cashValue <= 0) {
        notifications.show({
          title: "Efectivo requerido",
          message: "Registra el monto recibido para controlar el cambio.",
          color: "orange"
        });
        return false;
      }
      if (cashValue < cartTotals.total) {
        notifications.show({
          title: "Efectivo insuficiente",
          message: "El monto recibido es inferior al total de la venta.",
          color: "red"
        });
        return false;
      }
    }
    if (selectedPayment === "fiado") {
      if (!selectedFiadoClient) {
        notifications.show({
          title: "Cliente requerido",
          message: "Debes seleccionar un cliente autorizado para fiar.",
          color: "orange"
        });
        return false;
      }
      const client = clients.find((item) => item.id === selectedFiadoClient);
      if (!client || !client.authorized) {
        notifications.show({
          title: "Cliente no autorizado",
          message: "Selecciona un cliente con autorización para fiado.",
          color: "red"
        });
        return false;
      }

      const projected = client.balance + cartTotals.total;
      const available = client.limit - client.balance;

      // Debug: mostrar información de crédito
      console.log("🔍 Validación de crédito:", {
        cliente: client.name,
        límite: client.limit,
        deudaActual: client.balance,
        compra: cartTotals.total,
        proyectado: projected,
        disponible: available
      });

      if (projected > client.limit) {
        notifications.show({
          title: "Límite excedido",
          message: `Crédito disponible: ${formatCurrency(available)}. Compra: ${formatCurrency(cartTotals.total)}`,
          color: "red"
        });
        return false;
      }
    }

    return true;
  };

  const handleCompleteSale = async () => {
    if (!validateSale()) return;

    const timestamp = new Date().toISOString();
    const saleItems: SaleItem[] = cartDetailed.map((item) => ({
      id: generateId(),
      productId: item.product.id,
      name: item.product.name,
      price: item.product.price,
      quantity: item.quantity
    }));

    const cashValue =
      selectedPayment === "cash" && typeof cashReceived === "number" && Number.isFinite(cashReceived)
        ? cashReceived
        : null;

    const payload = {
      type: "sale",
      total: cartTotals.total,
      payment_method: selectedPayment,
      cash_received: cashValue,
      change_amount: cashValue !== null ? cartTotals.change : null,
      shift_id: activeShift?.id ?? null,
      seller: activeShift?.seller ?? "Mostrador",
      created_at: timestamp,
      items: saleItems,
      notes: selectedPayment === "fiado" ? { clientId: selectedFiadoClient } : null
    };

    const { data, error } = await supabase
      .from("pudahuel_sales")
      .insert(payload)
      .select("ticket")
      .single();

    if (error) {
      notifications.show({
        title: "Error al registrar la venta",
        message: error.message,
        color: "red"
      });
      return;
    }

    await Promise.all(
      saleItems.map((item) =>
        supabase
          .from("pudahuel_products")
          .update({ stock: (productMap.get(item.productId)?.stock ?? 0) - item.quantity })
          .eq("id", item.productId)
      )
    );

    if (selectedPayment === "fiado" && selectedFiadoClient) {
      const client = clients.find((item) => item.id === selectedFiadoClient);
      if (client) {
        const newBalance = client.balance + cartTotals.total;
        await supabase
          .from("pudahuel_clients")
          .update({ balance: newBalance })
          .eq("id", client.id);
        await supabase.from("pudahuel_client_movements").insert({
          client_id: client.id,
          amount: cartTotals.total,
          type: "fiado",
          description: `Compra ticket #${data?.ticket ?? "sin-ticket"}`,
          balance_after: newBalance
        });
      }
    }

    notifications.show({
      title: "Venta registrada",
      message: data?.ticket ? `Ticket #${data.ticket} generado correctamente.` : "Venta registrada correctamente.",
      color: "teal"
    });

    setCart([]);
    setCashReceived(undefined);
    setSelectedFiadoClient(null);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["products"] }),
      queryClient.invalidateQueries({ queryKey: ["sales"] }),
      queryClient.invalidateQueries({ queryKey: ["clients"] })
    ]);
  };

  const handleOpenShift = async ({ seller, type, initialCash }: { seller: string; type: ShiftType; initialCash: number }) => {
    const { error } = await supabase.from("pudahuel_shifts").insert({
      seller,
      type,
      start_time: new Date().toISOString(),
      status: "open",
      initial_cash: initialCash
    });

    if (error) {
      notifications.show({
        title: "No se pudo abrir el turno",
        message: error.message,
        color: "red"
      });
      return;
    }

    notifications.show({
      title: "Turno iniciado",
      message: `Turno ${type === "dia" ? "día" : "noche"} para ${seller} con ${formatCurrency(initialCash)} inicial.`,
      color: "teal"
    });
    await queryClient.invalidateQueries({ queryKey: ["shifts"] });
    shiftModalHandlers.close();
  };

  const handleCloseShift = async ({ cashCounted }: { cashCounted: number }) => {
    if (!activeShift) return;
    const summary = computeShiftSummary(sales, activeShift.id);
    const initialCash = activeShift.initial_cash ?? 0;
    const cashExpected = initialCash + (summary.byPayment.cash ?? 0);
    const difference = cashCounted - cashExpected;
    const { error } = await supabase
      .from("pudahuel_shifts")
      .update({
        end_time: new Date().toISOString(),
        status: "closed",
        cash_counted: cashCounted,
        cash_expected: cashExpected,
        difference,
        total_sales: summary.total,
        tickets: summary.tickets,
        payments_breakdown: summary.byPayment
      })
      .eq("id", activeShift.id);

    if (error) {
      notifications.show({
        title: "No se pudo cerrar el turno",
        message: error.message,
        color: "red"
      });
      return;
    }

    notifications.show({
      title: "Turno cerrado",
      message: "Se registró el cierre de caja correctamente.",
      color: difference === 0 ? "teal" : difference > 0 ? "green" : "orange"
    });

    await queryClient.invalidateQueries({ queryKey: ["shifts"] });
    shiftModalHandlers.close();
  };

  const handleCreateProduct = async (payload: ProductInput) => {
    const { error } = await supabase.from("pudahuel_products").insert({
      name: payload.name,
      category: payload.category,
      barcode: payload.barcode,
      price: payload.price,
      stock: payload.stock,
      min_stock: payload.minStock
    });

    if (error) {
      notifications.show({
        title: "No se pudo registrar el producto",
        message: error.message,
        color: "red"
      });
      return;
    }

    notifications.show({
      title: "Producto agregado",
      message: `${payload.name} ya forma parte del inventario.`,
      color: "teal"
    });
    await queryClient.invalidateQueries({ queryKey: ["products"] });
  };

  const handleAddStock = async (productId: string, quantity: number, reason: string) => {
    const product = products.find((p) => p.id === productId);
    if (!product) return;

    const newStock = product.stock + quantity;
    const { error } = await supabase
      .from("pudahuel_products")
      .update({ stock: newStock })
      .eq("id", productId);

    if (error) {
      notifications.show({
        title: "No se pudo actualizar el stock",
        message: error.message,
        color: "red"
      });
      return;
    }

    notifications.show({
      title: "Stock actualizado",
      message: `${product.name}: +${quantity} unidades (${reason})`,
      color: "teal"
    });

    await queryClient.invalidateQueries({ queryKey: ["products"] });
    addStockModalHandlers.close();
    setSelectedProductForStock(null);
  };

  const handleEditProduct = async (productId: string, updates: Partial<ProductInput>) => {
    const product = products.find((p) => p.id === productId);
    if (!product) return;

    const payload: any = {};
    if (updates.name !== undefined) payload.name = updates.name;
    if (updates.category !== undefined) payload.category = updates.category;
    if (updates.barcode !== undefined) payload.barcode = updates.barcode;
    if (updates.price !== undefined) payload.price = updates.price;
    if (updates.stock !== undefined) payload.stock = updates.stock;
    if (updates.minStock !== undefined) payload.min_stock = updates.minStock;

    const { error } = await supabase
      .from("pudahuel_products")
      .update(payload)
      .eq("id", productId);

    if (error) {
      notifications.show({
        title: "No se pudo actualizar el producto",
        message: error.message,
        color: "red"
      });
      return;
    }

    notifications.show({
      title: "Producto actualizado",
      message: `${updates.name ?? product.name} se actualizó correctamente.`,
      color: "teal"
    });

    await queryClient.invalidateQueries({ queryKey: ["products"] });
    editProductModalHandlers.close();
    setSelectedProductForEdit(null);
  };

  const handleDeleteProduct = async (productId: string) => {
    const product = products.find((p) => p.id === productId);
    if (!product) return;

    const { error } = await supabase.from("pudahuel_products").delete().eq("id", productId);

    if (error) {
      notifications.show({
        title: "No se pudo eliminar el producto",
        message: error.message,
        color: "red"
      });
      return;
    }

    notifications.show({
      title: "Producto eliminado",
      message: `${product.name} se eliminó del inventario.`,
      color: "teal"
    });

    await queryClient.invalidateQueries({ queryKey: ["products"] });
    deleteProductModalHandlers.close();
    setSelectedProductForDelete(null);
  };

  const handleRegisterReturn = async () => {
    const sale = sales.find((item) => item.id === returnSaleId);
    if (!sale) return;
    const items = sale.items
      .map((item) => ({
        ...item,
        quantity: Math.min(item.quantity, returnItems[item.id] ?? 0)
      }))
      .filter((item) => item.quantity > 0);
    const totalReturn = items.reduce((acc, item) => acc + item.price * item.quantity, 0);
    if (items.length === 0 || totalReturn <= 0) {
      notifications.show({
        title: "Sin cambios",
        message: "Selecciona cantidades a devolver.",
        color: "orange"
      });
      return;
    }

    const timestamp = new Date().toISOString();
    const returnTicket = `R-${sale.ticket}`;

    const { error } = await supabase.from("pudahuel_sales").insert({
      ticket: returnTicket,
      type: "return",
      total: totalReturn,
      payment_method: returnRefundMethod,
      shift_id: sale.shiftId,
      seller: sale.seller,
      created_at: timestamp,
      items,
      notes: {
        reason: returnReason,
        originalTicket: sale.ticket,
        originalPaymentMethod: sale.paymentMethod,
        refundMethod: returnRefundMethod
      }
    });

    if (error) {
      notifications.show({
        title: "No se pudo registrar la devolución",
        message: error.message,
        color: "red"
      });
      return;
    }

    await Promise.all(
      items.map((item) =>
        supabase
          .from("pudahuel_products")
          .update({ stock: (productMap.get(item.productId)?.stock ?? 0) + item.quantity })
          .eq("id", item.productId)
      )
    );

    const refundMethodLabel = returnRefundMethod === "cash" ? "en efectivo" : returnRefundMethod === "card" ? "por tarjeta" : "por cambio de producto";
    notifications.show({
      title: "Devolución registrada",
      message: `Se devolvieron ${formatCurrency(totalReturn)} ${refundMethodLabel} al cliente.`,
      color: "teal"
    });

    setReturnItems({});
    setReturnSaleId(null);
    setReturnReason("");
    setReturnRefundMethod("cash");
    returnDrawerHandlers.close();
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["sales"] }),
      queryClient.invalidateQueries({ queryKey: ["products"] })
    ]);
  };

  const handleChangePaymentMethod = async (saleId: string, method: PaymentMethod) => {
    const { error } = await supabase
      .from("pudahuel_sales")
      .update({ payment_method: method })
      .eq("id", saleId);

    if (error) {
      notifications.show({
        title: "No se pudo actualizar el método",
        message: error.message,
        color: "red"
      });
      return;
    }

    notifications.show({
      title: "Método actualizado",
      message: "Se cambió el método de pago del ticket seleccionado.",
      color: "teal"
    });
    setPaymentEditSaleId(null);
    await queryClient.invalidateQueries({ queryKey: ["sales"] });
  };

  const handleFiadoMovement = async ({ clientId, mode, amount, description }: { clientId: string; mode: "abono" | "total"; amount: number; description: string }) => {
    const client = clients.find((item) => item.id === clientId);
    if (!client) return;
    const newBalance = mode === "total" ? 0 : Math.max(client.balance - amount, 0);
    const { error } = await supabase
      .from("pudahuel_clients")
      .update({ balance: newBalance })
      .eq("id", clientId);

    if (error) {
      notifications.show({
        title: "No se pudo registrar el movimiento",
        message: error.message,
        color: "red"
      });
      return;
    }

    const movement: Partial<ClientMovement> = {
      client_id: clientId,
      amount,
      type: mode === "total" ? "pago-total" : "abono",
      description: mode === "total" ? "Pago total de la deuda" : description || "Abono registrado",
      balance_after: newBalance,
      created_at: new Date().toISOString()
    };

    await supabase.from("pudahuel_client_movements").insert(movement);

    notifications.show({
      title: "Movimiento registrado",
      message: "Se actualizó la deuda del cliente.",
      color: "teal"
    });
    await queryClient.invalidateQueries({ queryKey: ["clients"] });
  };

  const handleAuthorizeFiado = async (clientId: string, authorized: boolean) => {
    const { error } = await supabase
      .from("pudahuel_clients")
      .update({ authorized })
      .eq("id", clientId);

    if (error) {
      notifications.show({
        title: "No se pudo actualizar el estado",
        message: error.message,
        color: "red"
      });
      return;
    }

    notifications.show({
      title: "Actualizado",
      message: "Se modificó la autorización del cliente.",
      color: "teal"
    });
    await queryClient.invalidateQueries({ queryKey: ["clients"] });
  };

  const handleCreateClient = async ({ name, limit, authorized }: { name: string; limit: number; authorized: boolean }) => {
    const { data, error } = await supabase
      .from("pudahuel_clients")
      .insert({
        name,
        authorized,
        balance: 0,
        "limit": limit
      })
      .select('id, name, authorized, balance, "limit", updated_at')
      .single();

    if (error) {
      notifications.show({
        title: "No se pudo crear el cliente",
        message: error.message,
        color: "red"
      });
      return;
    }

    // Debug: verificar que se guardó correctamente
    console.log("✅ Cliente creado en DB:", data);

    notifications.show({
      title: "Cliente creado",
      message: `${name} fue agregado exitosamente con límite de ${formatCurrency(limit)}.`,
      color: "teal"
    });
    await queryClient.invalidateQueries({ queryKey: ["clients"] });
    clientModalHandlers.close();
  };

  const filteredSalesForReports = useMemo(() => {
    const now = dayjs();
    let start: dayjs.Dayjs | null = null;
    let end: dayjs.Dayjs | null = null;

    switch (reportFilters.range) {
      case "today":
        start = now.startOf("day");
        end = now.endOf("day");
        break;
      case "week":
        start = now.startOf("week");
        end = now.endOf("week");
        break;
      case "month":
        start = now.startOf("month");
        end = now.endOf("month");
        break;
      case "custom":
        start = reportFilters.from ? dayjs(reportFilters.from) : null;
        end = reportFilters.to ? dayjs(reportFilters.to) : null;
        break;
      default:
        break;
    }

    return sales.filter((sale) => {
      if (sale.type === "return") return false;
      const date = dayjs(sale.created_at);
      if (start && date.isBefore(start)) return false;
      if (end && date.isAfter(end)) return false;
      return true;
    });
  }, [sales, reportFilters]);

  const reportSummary = useMemo(() => {
    const total = filteredSalesForReports.reduce((acc, sale) => acc + sale.total, 0);
    const tickets = filteredSalesForReports.length;
    const byPayment = filteredSalesForReports.reduce<Record<PaymentMethod, number>>(
      (acc, sale) => {
        acc[sale.paymentMethod] += sale.total;
        return acc;
      },
      { cash: 0, card: 0, transfer: 0, fiado: 0, staff: 0 }
    );
    const productMap = new Map<string, { id: string; name: string; total: number; quantity: number }>();
    filteredSalesForReports.forEach((sale) => {
      sale.items.forEach((item) => {
        const target = productMap.get(item.productId) ?? { id: item.productId, name: item.name, total: 0, quantity: 0 };
        target.total += item.price * item.quantity;
        target.quantity += item.quantity;
        productMap.set(item.productId, target);
      });
    });
    const topProducts = Array.from(productMap.values()).sort((a, b) => b.quantity - a.quantity).slice(0, 20);
    const bySeller = filteredSalesForReports.reduce<Record<string, { seller: string; total: number; tickets: number }>>(
      (acc, sale) => {
        const key = sale.seller ?? "Mostrador";
        const entry = acc[key] ?? { seller: key, total: 0, tickets: 0 };
        entry.total += sale.total;
        entry.tickets += 1;
        acc[key] = entry;
        return acc;
      },
      {}
    );

    return {
      total,
      tickets,
      byPayment,
      topProducts,
      bySeller: Object.values(bySeller)
    };
  }, [filteredSalesForReports]);

  const shiftHistory = useMemo(
    () =>
      shifts
        .filter((shift) => shift.status === "closed")
        .sort((a, b) => dayjs(b.end ?? b.start).valueOf() - dayjs(a.end ?? a.start).valueOf()),
    [shifts]
  );

  const currentTab = useMemo(() => TABS.find((tab) => tab.id === activeTab), [activeTab]);

  // Si está en modo de pantalla para cliente, renderizar SOLO la ventana flotante
  if (customerDisplay && activeTab === "pos") {
    return (
      <>
        <Notifications position="top-right" />
        <CustomerDisplay
          cart={cartDetailed}
          total={cartTotals.total}
          change={cartTotals.change}
          paymentLabel={paymentOption?.label ?? "Sin método"}
        />
      </>
    );
  }

  return (
    <AppShell
      header={{ height: 72 }}
      navbar={{
        width: sidebarCollapsed ? 80 : 280,
        breakpoint: "md",
        collapsed: { mobile: true }
      }}
      padding="lg"
    >
      <AppShell.Header
        style={{
          background: "linear-gradient(110deg, #1e3a8a 0%, #312e81 40%, #0f172a 100%)",
          borderBottom: "none",
          boxShadow: "0 18px 45px rgba(15, 23, 42, 0.35)"
        }}
      >
        <Group
          justify="space-between"
          align="center"
          h="100%"
          px="md"
          wrap="nowrap"
          gap="xs"
        >
          <Group gap="xs" align="center" wrap="nowrap">
            <ThemeIcon
              size={38}
              radius="lg"
              variant="gradient"
              gradient={{ from: "blue.4", to: "cyan.4", deg: 120 }}
            >
              <LayoutDashboard size={20} />
            </ThemeIcon>
            <Stack gap={0} style={{ color: "white" }}>
              <Text fw={700} fz={16} lh={1.2}>
                Negocio Eliana Maipú
              </Text>
              <Text fz="xs" style={{ color: "rgba(255,255,255,0.75)" }}>
                {now.format("ddd, D MMM • HH:mm")}
              </Text>
            </Stack>
          </Group>
          <Group gap="xs" align="center" wrap="nowrap">
            {activeShift && (
              <Badge
                size="md"
                variant="light"
                style={{ background: "rgba(255,255,255,0.18)", color: "white", padding: "0.4rem 0.75rem" }}
              >
                {activeShift.seller} • {activeShift.type === "dia" ? "Día" : "Noche"}
              </Badge>
            )}
            {userRole && (
              <ActionIcon
                variant="light"
                color="yellow"
                size="md"
                radius="md"
                onClick={handleLockAdmin}
                style={{ background: "rgba(255,255,255,0.18)" }}
              >
                <KeyRound size={16} />
              </ActionIcon>
            )}
            {activeShift ? (
              <Button
                size="xs"
                variant="light"
                color="red"
                onClick={() => {
                  if (!activeShift) {
                    notifications.show({
                      title: "Sin turno activo",
                      message: "No hay un turno abierto para cerrar.",
                      color: "orange"
                    });
                    return;
                  }
                  setShiftModalMode("close");
                  shiftModalHandlers.open();
                }}
                style={{ background: "rgba(255,255,255,0.18)", color: "white" }}
              >
                Cerrar
              </Button>
            ) : (
              <Button
                size="xs"
                variant="light"
                color="teal"
                onClick={() => {
                  setShiftModalMode("open");
                  shiftModalHandlers.open();
                }}
                style={{ background: "rgba(255,255,255,0.18)", color: "white" }}
              >
                Abrir
              </Button>
            )}
            <ActionIcon
              variant="light"
              size="md"
              radius="md"
              onClick={() => setCustomerDisplay((prev) => !prev)}
              style={{
                background: customerDisplay ? "rgba(248,113,113,0.25)" : "rgba(255,255,255,0.18)"
              }}
            >
              <MonitorPlay size={16} color="white" />
            </ActionIcon>
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="md" className="sidebar-nav">
        <Stack gap="md">
          {/* Botón de colapso */}
          <Group justify={sidebarCollapsed ? "center" : "flex-end"}>
            <ActionIcon
              variant="light"
              color="indigo"
              size="lg"
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            >
              {sidebarCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
            </ActionIcon>
          </Group>

          {!sidebarCollapsed ? (
            <>
              <Paper withBorder radius="lg" p="md">
                {activeShift ? (
                  <Stack gap="sm">
                    <Group justify="space-between" align="flex-start">
                      <Stack gap={2}>
                        <Text fw={700}>Turno activo</Text>
                        <Text size="xs" c="dimmed">
                          {activeShift.seller} • desde {formatDateTime(activeShift.start)}
                        </Text>
                      </Stack>
                      <Badge color="teal" variant="light">
                        {activeShift.type === "dia" ? "Día" : "Noche"}
                      </Badge>
                    </Group>
                    <Divider />
                    <Group justify="space-between">
                      <Text size="sm" c="dimmed">
                        Total ventas
                      </Text>
                      <Text fw={700}>{formatCurrency(shiftSummary.total)}</Text>
                    </Group>
                    <Group justify="space-between">
                      <Text size="sm" c="dimmed">
                        Tickets
                      </Text>
                      <Text fw={700}>{shiftSummary.tickets}</Text>
                    </Group>
                    <Divider />
                    <Group justify="space-between">
                      <Text size="sm" c="dimmed" fw={600}>
                        Efectivo en caja
                      </Text>
                      <Text fw={700} c="teal">
                        {formatCurrency((activeShift.initial_cash ?? 0) + (shiftSummary.byPayment.cash ?? 0))}
                      </Text>
                    </Group>
                    <Text size="xs" c="dimmed" pl="xs">
                      Inicial: {formatCurrency(activeShift.initial_cash ?? 0)} + Ventas: {formatCurrency(shiftSummary.byPayment.cash ?? 0)}
                    </Text>
                    <Divider />
                    {PAYMENT_ORDER.map((method) => (
                      <Group key={method} justify="space-between">
                        <Text size="xs" c="dimmed">
                          {PAYMENT_LABELS[method].toUpperCase()}
                        </Text>
                        <Text fw={600}>{formatCurrency(shiftSummary.byPayment[method] ?? 0)}</Text>
                      </Group>
                    ))}
                  </Stack>
                ) : (
                  <Stack gap="xs">
                    <Text fw={700}>Sin turno activo</Text>
                    <Text size="sm" c="dimmed">
                      Registra la apertura desde el encabezado para comenzar a mostrar indicadores.
                    </Text>
                  </Stack>
                )}
              </Paper>

              <Stack gap="xs">
                {TABS.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  const disabled = !hasAccess(tab);
                  const lowStockCount = tab.id === "inventory" ? products.filter((p) => p.stock <= p.minStock).length : 0;

                  return (
                    <div
                      key={tab.id}
                      className={`nav-item ${isActive ? "active" : ""}`}
                      onClick={() => guardTabChange(tab.id)}
                      style={{ opacity: disabled ? 0.55 : 1 }}
                    >
                      <div className="nav-item-icon">
                        <Icon size={22} />
                      </div>
                      <Text style={{ flex: 1 }}>{tab.label}</Text>
                      {lowStockCount > 0 && !disabled && (
                        <div className="nav-item-badge">
                          {lowStockCount}
                        </div>
                      )}
                      {disabled && (
                        <Badge size="xs" color="gray" variant="dot">
                          Bloqueado
                        </Badge>
                      )}
                    </div>
                  );
                })}
              </Stack>

              <Paper withBorder p="md" radius="lg" style={{ background: "linear-gradient(135deg, rgba(15, 23, 42, 0.08), rgba(99, 102, 241, 0.12))" }}>
                <Stack gap="xs">
                  <Group gap="xs">
                    <ThemeIcon color="indigo" variant="light" size="md">
                      <TrendingUp size={18} />
                    </ThemeIcon>
                    <Text size="sm" fw={700} style={{ color: "#1f2937" }}>
                      Análisis en tiempo real
                    </Text>
                  </Group>
                  <Text size="xs" c="dimmed" style={{ lineHeight: 1.5 }}>
                    Consulta métricas clave del turno y controla alertas de stock en un solo lugar.
                  </Text>
                </Stack>
              </Paper>

              {userRole ? (
                <Button variant="light" color="yellow" onClick={handleLockAdmin}>
                  Cerrar sesión administrativa
                </Button>
              ) : (
                <Button
                  variant="gradient"
                  gradient={{ from: "indigo", to: "blue", deg: 90 }}
                  onClick={() => {
                    setPendingTab(activeTab);
                    passwordModalHandlers.open();
                  }}
                  leftSection={<ShieldCheck size={16} />}
                >
                  Desbloquear secciones
                </Button>
              )}
            </>
          ) : (
            // Vista colapsada - solo iconos
            <Stack gap="xs">
              {TABS.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                const disabled = !hasAccess(tab);
                const lowStockCount = tab.id === "inventory" ? products.filter((p) => p.stock <= p.minStock).length : 0;

                return (
                  <Tooltip key={tab.id} label={tab.label} position="right" withArrow>
                    <ActionIcon
                      size="xl"
                      variant={isActive ? "filled" : "light"}
                      color={isActive ? "indigo" : "gray"}
                      onClick={() => guardTabChange(tab.id)}
                      style={{ opacity: disabled ? 0.55 : 1, position: "relative" }}
                    >
                      <Icon size={24} />
                      {lowStockCount > 0 && !disabled && (
                        <Badge
                          size="xs"
                          color="red"
                          variant="filled"
                          circle
                          style={{ position: "absolute", top: -4, right: -4 }}
                        >
                          {lowStockCount}
                        </Badge>
                      )}
                    </ActionIcon>
                  </Tooltip>
                );
              })}
            </Stack>
          )}
        </Stack>
      </AppShell.Navbar>

      <AppShell.Main style={{ paddingBottom: "180px" }}>
        <Notifications position="top-right" />
        {!currentTab ? null : (
          <Stack gap="xl">
            {activeTab === "dashboard" && (
              <DashboardView
                products={products}
                sales={sales}
                clients={clients}
                activeShift={activeShift}
                shiftSummary={shiftSummary}
                onEditSale={(saleId) => setPaymentEditSaleId(saleId)}
              />
            )}
            {activeTab === "pos" && (
              <Stack gap="xl">
                <SimpleGrid cols={{ base: 1, md: 3 }} spacing="md">
                  <Paper withBorder radius="lg" p="md" style={{ background: "linear-gradient(135deg, rgba(59,130,246,0.12), rgba(147,197,253,0.18))" }}>
                    <Stack gap={4}>
                      <Group justify="space-between">
                        <Group gap="xs">
                          <ThemeIcon variant="gradient" gradient={{ from: "blue", to: "cyan" }} radius="md">
                            <TrendingUp size={18} />
                          </ThemeIcon>
                          <Text size="sm" c="dimmed">
                            Ventas del turno
                          </Text>
                        </Group>
                        <Badge size="sm" color="blue" variant="light">
                          {activeShift ? "En curso" : "General"}
                        </Badge>
                      </Group>
                      <Text fw={700} fz="xl">
                        {formatCurrency(shiftSummary.total)}
                      </Text>
                      <Text size="xs" c="dimmed">
                        {shiftSummary.tickets} tickets registrados ({formatCurrency(shiftSummary.byPayment.cash ?? 0)} en efectivo)
                      </Text>
                    </Stack>
                  </Paper>
                  <Paper withBorder radius="lg" p="md" style={{ background: "linear-gradient(135deg, rgba(16,185,129,0.12), rgba(45,212,191,0.18))" }}>
                    <Stack gap={4}>
                      <Group gap="xs">
                        <ThemeIcon variant="gradient" gradient={{ from: "teal", to: "green" }} radius="md">
                          <ShoppingCart size={18} />
                        </ThemeIcon>
                        <Text size="sm" c="dimmed">
                          Carrito actual
                        </Text>
                      </Group>
                      <Group justify="space-between" align="flex-end">
                        <Text fw={700} fz="xl">
                          {formatCurrency(cartTotals.total)}
                        </Text>
                        <Badge size="sm" color="teal" variant="light">
                          {cartTotals.items} productos
                        </Badge>
                      </Group>
                      <Text size="xs" c="dimmed">
                        Selecciona el método de pago y confirma para generar el ticket.
                      </Text>
                    </Stack>
                  </Paper>
                  <Paper
                    withBorder
                    radius="lg"
                    p="md"
                    style={{
                      background: "linear-gradient(135deg, rgba(251,191,36,0.14), rgba(251,146,60,0.18))",
                      cursor: "pointer",
                      transition: "all 0.2s ease"
                    }}
                    onClick={() => lowStockModalHandlers.open()}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = "translateY(-2px)";
                      e.currentTarget.style.boxShadow = "0 8px 20px rgba(251, 146, 60, 0.3)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = "translateY(0)";
                      e.currentTarget.style.boxShadow = "";
                    }}
                  >
                    <Stack gap={4}>
                      <Group justify="space-between">
                        <Group gap="xs">
                          <ThemeIcon variant="gradient" gradient={{ from: "orange", to: "yellow" }} radius="md">
                            <AlertTriangle size={18} />
                          </ThemeIcon>
                          <Text size="sm" c="dimmed">
                            Stock crítico
                          </Text>
                        </Group>
                        <ActionIcon variant="subtle" color="orange" size="sm">
                          <Search size={16} />
                        </ActionIcon>
                      </Group>
                      <Group justify="space-between" align="center">
                        <Text fw={700} fz="xl">
                          {lowStockProducts.length}
                        </Text>
                        <Badge color="orange" variant="light" size="sm">
                          {lowStockProducts.length > 0 ? "Atención urgente" : "Todo en orden"}
                        </Badge>
                      </Group>
                      <Text size="xs" c="dimmed">
                        Click para ver detalle de productos bajo stock mínimo.
                      </Text>
                    </Stack>
                  </Paper>
                </SimpleGrid>
                <Grid gutter="xl">
                  <Grid.Col span={{ base: 12, xl: 7 }}>
                    <Stack gap="md">
                      <Card withBorder radius="lg" shadow="sm">
                        <Stack gap="md">
                          <Group justify="space-between" align="flex-start">
                            <div>
                              <Title order={3}>Punto de venta</Title>
                              <Text c="dimmed">Busca, filtra y agrega productos para generar una venta.</Text>
                            </div>
                            {lowStockProducts.length > 0 && (
                              <Badge color="orange" size="lg">
                                {lowStockProducts.length} productos con bajo stock
                              </Badge>
                            )}
                          </Group>
                          <TextInput
                            placeholder="Buscar por nombre, categoría o código de barras"
                            value={search}
                            onChange={(event) => setSearch(event.currentTarget.value)}
                            rightSectionWidth={120}
                            rightSection={
                              <Select
                                placeholder="Atajos"
                                data={autoCompleteData.map((name) => ({ value: name, label: name }))}
                                searchable
                                nothingFoundMessage="Sin coincidencias"
                                value={null}
                                onChange={(value) => {
                                  if (!value) return;
                                  setSearch(value);
                                  const product = products.find((item) => item.name === value);
                                  if (product) handleAddProductToCart(product.id);
                                }}
                              />
                            }
                          />
                          <div>
                            <Group gap="xs" mb="xs">
                              <Text size="sm" fw={500} c="dimmed">
                                Filtrar por categoría:
                              </Text>
                              <Badge size="sm" variant="light" color="blue">
                                {posCategoryFilter ? `${filteredProducts.length} productos` : `${products.length} productos`}
                              </Badge>
                            </Group>
                            <Chip.Group
                              multiple={false}
                              value={posCategoryFilter || ""}
                              onChange={(value) => setPosCategoryFilter(typeof value === 'string' ? (value || null) : null)}
                            >
                              <Group gap="xs">
                                <Chip value="" variant="filled" color="gray" size="sm">
                                  Todas
                                </Chip>
                                {uniqueCategories.map((category) => (
                                  <Chip key={category} value={category} variant="filled" size="sm">
                                    {category}
                                  </Chip>
                                ))}
                              </Group>
                            </Chip.Group>
                          </div>
                          <ScrollArea h={isMobile ? 400 : 720}>
                            <SimpleGrid cols={{ base: 1, sm: 2, md: 3, lg: 4 }} spacing="md">
                              {filteredProducts.map((product) => {
                                const stockRatio = Math.min(
                                  100,
                                  Math.round((product.stock / Math.max(product.minStock || 1, 1)) * 100)
                                );
                                return (
                                  <Card
                                    key={product.id}
                                    withBorder
                                    shadow="sm"
                                    radius="lg"
                                    onClick={() => handleAddProductToCart(product.id)}
                                    style={{ cursor: "pointer" }}
                                  >
                                    <Stack gap="xs">
                                      <Group justify="space-between" align="flex-start">
                                        <Stack gap={4}>
                                          <Text fw={600}>{product.name}</Text>
                                          <Text size="sm" c="dimmed">
                                            {product.category}
                                          </Text>
                                        </Stack>
                                        <Badge color="indigo" variant="light">
                                          {formatCurrency(product.price)}
                                        </Badge>
                                      </Group>
                                      <Group justify="space-between">
                                        <Text size="sm" c="dimmed">
                                          Stock actual: {product.stock}
                                        </Text>
                                        <Text size="sm" c="dimmed">
                                          Mínimo: {product.minStock}
                                        </Text>
                                      </Group>
                                      <Progress
                                        value={stockRatio}
                                        color={stockRatio < 50 ? "orange" : "teal"}
                                        radius="xl"
                                      />
                                      <Group justify="space-between">
                                        <Text size="xs" c="dimmed">
                                          {product.barcode ? `SKU: ${product.barcode}` : "Sin código asignado"}
                                        </Text>
                                        {product.stock <= product.minStock ? (
                                          <Badge color="orange" variant="light" size="sm">
                                            Bajo stock
                                          </Badge>
                                        ) : (
                                          <Badge color="teal" variant="light" size="sm">
                                            Disponible
                                          </Badge>
                                        )}
                                      </Group>
                                    </Stack>
                                  </Card>
                                );
                              })}
                            </SimpleGrid>
                          </ScrollArea>
                        </Stack>
                      </Card>
                    </Stack>
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, xl: 5 }}>
                    <Stack gap="md">
                      <Card
                        withBorder
                        radius="lg"
                        shadow="md"
                        style={{
                          borderWidth: "2px",
                          borderColor: "rgba(59, 130, 246, 0.4)",
                          boxShadow: "0 4px 16px rgba(59, 130, 246, 0.15), 0 2px 8px rgba(0, 0, 0, 0.08)"
                        }}
                      >
                        <Stack gap="md">
                          <Group justify="space-between">
                            <Title order={4}>Carrito de venta</Title>
                            <Group gap="xs">
                              <Tooltip label={customerDisplay ? "Cerrar vista cliente" : "Mostrar al cliente"}>
                                <ActionIcon
                                  variant="light"
                                  color="indigo"
                                  onClick={() => setCustomerDisplay((prev) => !prev)}
                                >
                                  <MonitorPlay size={18} />
                                </ActionIcon>
                              </Tooltip>
                              <Tooltip label="Vaciar carrito">
                                <ActionIcon
                                  variant="subtle"
                                  color="red"
                                  onClick={() => setCart([])}
                                  disabled={cart.length === 0}
                                >
                                  <RefreshCcw size={18} />
                                </ActionIcon>
                              </Tooltip>
                            </Group>
                          </Group>
                          {cartDetailed.length === 0 ? (
                            <Paper withBorder p="xl" radius="md">
                              <Text c="dimmed" ta="center">
                                Agrega productos para iniciar la venta.
                              </Text>
                            </Paper>
                          ) : (
                            <ScrollArea h={320}>
                              <Table highlightOnHover>
                                <Table.Thead>
                                  <Table.Tr>
                                    <Table.Th>Producto</Table.Th>
                                    <Table.Th>Precio</Table.Th>
                                    <Table.Th>Cantidad</Table.Th>
                                    <Table.Th>Subtotal</Table.Th>
                                    <Table.Th style={{ width: 120 }}>Acciones</Table.Th>
                                  </Table.Tr>
                                </Table.Thead>
                                <Table.Tbody>
                                  {cartDetailed.map((item) => (
                                    <Table.Tr key={item.product.id}>
                                      <Table.Td>
                                        <Stack gap={2}>
                                          <Text fw={600}>{item.product.name}</Text>
                                          <Text size="xs" c="dimmed">
                                            {item.product.barcode || "Sin código asignado"}
                                          </Text>
                                        </Stack>
                                      </Table.Td>
                                      <Table.Td>{formatCurrency(item.product.price)}</Table.Td>
                                      <Table.Td>
                                        <Group gap="xs">
                                          <ActionIcon
                                            size="sm"
                                            variant="light"
                                            onClick={() => handleUpdateCartQuantity(item.product.id, item.quantity - 1)}
                                          >
                                            <Text fw={700}>-</Text>
                                          </ActionIcon>
                                          <Text fw={600}>{item.quantity}</Text>
                                          <ActionIcon
                                            size="sm"
                                            variant="light"
                                            onClick={() => handleUpdateCartQuantity(item.product.id, item.quantity + 1)}
                                          >
                                            <Text fw={700}>+</Text>
                                          </ActionIcon>
                                        </Group>
                                      </Table.Td>
                                      <Table.Td>
                                        <Text fw={600}>{formatCurrency(item.subtotal)}</Text>
                                      </Table.Td>
                                      <Table.Td>
                                        <Button
                                          variant="light"
                                          color="red"
                                          size="xs"
                                          onClick={() => handleRemoveCartItem(item.product.id)}
                                        >
                                          Quitar
                                        </Button>
                                      </Table.Td>
                                    </Table.Tr>
                                  ))}
                                </Table.Tbody>
                              </Table>
                            </ScrollArea>
                          )}
                          <Divider />
                          <Stack gap="md">
                            <Stack gap="xs">
                              <Text fw={600} size="sm">Método de pago</Text>
                              <Group gap="xs">
                                {PAYMENT_OPTIONS.map((option) => (
                                  <Button
                                    key={option.id}
                                    variant={selectedPayment === option.id ? "filled" : "light"}
                                    color={option.accent}
                                    size="sm"
                                    leftSection={<option.icon size={16} />}
                                    onClick={() => handleSelectPayment(option.id)}
                                    style={{
                                      flex: 1,
                                      minWidth: "fit-content",
                                      height: "2.5rem",
                                      fontWeight: selectedPayment === option.id ? 700 : 600
                                    }}
                                  >
                                    {option.label}
                                  </Button>
                                ))}
                              </Group>
                            </Stack>
                            {selectedPayment === "fiado" && (
                              <Select
                                label="Cliente autorizado"
                                placeholder="Selecciona un cliente"
                                data={clients
                                  .filter((client) => client.authorized)
                                  .map((client) => ({
                                    value: client.id,
                                    label: `${client.name} • ${formatCurrency(client.balance)}`
                                  }))}
                                value={selectedFiadoClient}
                                onChange={(value) => setSelectedFiadoClient(value)}
                              />
                            )}
                            {selectedPayment === "cash" && (
                              <NumberInput
                                label="Efectivo recibido"
                                placeholder="Monto entregado por el cliente"
                                thousandSeparator="."
                                decimalSeparator=","
                                value={cashReceived ?? undefined}
                                onChange={(value) => {
                                  if (value === "" || value === null) {
                                    setCashReceived(undefined);
                                    return;
                                  }
                                  const parsed = typeof value === "number" ? value : Number(value);
                                  setCashReceived(Number.isFinite(parsed) ? parsed : undefined);
                                }}
                                min={0}
                              />
                            )}
                            <Paper withBorder p="md" radius="md">
                              <Stack gap="xs">
                                <Group justify="space-between">
                                  <Text c="dimmed">Productos</Text>
                                  <Text fw={600}>{cartTotals.items}</Text>
                                </Group>
                                <Group justify="space-between">
                                  <Text>Total</Text>
                                  <Text fw={700}>{formatCurrency(cartTotals.total)}</Text>
                                </Group>
                                {selectedPayment === "cash" && typeof cashReceived === "number" && Number.isFinite(cashReceived) && (
                                  <Group justify="space-between">
                                    <Text>Cambio</Text>
                                    <Text fw={600} c={cartTotals.change >= 0 ? "teal" : "red"}>
                                      {formatCurrency(cartTotals.change)}
                                    </Text>
                                  </Group>
                                )}
                              </Stack>
                            </Paper>
                            <Group>
                              <Button
                                leftSection={<Receipt size={18} />}
                                onClick={handleCompleteSale}
                                disabled={cartDetailed.length === 0}
                                fullWidth
                              >
                                Cobrar y generar ticket
                              </Button>
                              <Button
                                variant="light"
                                color="violet"
                                onClick={() => returnDrawerHandlers.open()}
                                fullWidth
                              >
                                Gestionar devolución
                              </Button>
                            </Group>
                          </Stack>
                        </Stack>
                      </Card>
                    </Stack>
                  </Grid.Col>
                </Grid>
              </Stack>
            )}
            {activeTab === "inventory" && (
              <InventoryView
                products={products}
                search={inventorySearch}
                onSearchChange={setInventorySearch}
                categoryFilter={inventoryCategoryFilter}
                onCategoryFilterChange={setInventoryCategoryFilter}
                stockFilter={inventoryStockFilter}
                onStockFilterChange={setInventoryStockFilter}
                onRefresh={() => productQuery.refetch()}
                onNewProduct={() => {
                  setSelectedProductForEdit(null);
                  editProductModalHandlers.open();
                }}
                onAddStock={(productId) => {
                  setSelectedProductForStock(productId);
                  addStockModalHandlers.open();
                }}
                onEditProduct={(product) => {
                  setSelectedProductForEdit(product);
                  editProductModalHandlers.open();
                }}
                onDeleteProduct={(product) => {
                  setSelectedProductForDelete(product);
                  deleteProductModalHandlers.open();
                }}
              />
            )}
            {activeTab === "fiados" && (
              <FiadosView
                clients={clients}
                onAuthorize={handleAuthorizeFiado}
                onOpenModal={(clientId, mode) => {
                  setFiadoModalClientId(clientId);
                  setFiadoModalMode(mode);
                  fiadoModalHandlers.open();
                }}
                onOpenClientModal={() => clientModalHandlers.open()}
              />
            )}
            {activeTab === "reports" && (
              <ReportsView
                filters={reportFilters}
                onChangeFilters={setReportFilters}
                summary={reportSummary}
              />
            )}
            {activeTab === "shifts" && (
              <ShiftsView
                activeShift={activeShift}
                summary={shiftSummary}
                history={shiftHistory}
                sales={sales}
                products={products}
              />
            )}
          </Stack>
        )}
      </AppShell.Main>

      {isMobile && (
        <Paper
          radius="xl"
          shadow="lg"
          withBorder
          p="sm"
          style={{
            position: "fixed",
            bottom: 16,
            left: 16,
            right: 16,
            zIndex: 20
          }}
        >
          <Stack gap="sm">
            <Grid gutter="xs">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const disabled = !hasAccess(tab);
              return (
                <Grid.Col key={tab.id} span={12 / TABS.length}>
                  <Button
                    variant={activeTab === tab.id ? "light" : "subtle"}
                    fullWidth
                    onClick={() => guardTabChange(tab.id)}
                    leftSection={<Icon size={18} />}
                    style={{ opacity: disabled ? 0.6 : 1 }}
                  >
                    {tab.label}
                  </Button>
                </Grid.Col>
              );
            })}
            </Grid>
            {userRole ? (
              <Button size="sm" variant="light" color="yellow" onClick={handleLockAdmin}>
                Cerrar sesión administrativa
              </Button>
            ) : (
              <Button
                size="sm"
                variant="gradient"
                gradient={{ from: "indigo", to: "blue", deg: 90 }}
                onClick={() => {
                  setPendingTab(activeTab);
                  passwordModalHandlers.open();
                }}
                leftSection={<ShieldCheck size={16} />}
              >
                Desbloquear secciones
              </Button>
            )}
          </Stack>
        </Paper>
      )}

      <PasswordModal
        opened={passwordModalOpened}
        onClose={passwordModalHandlers.close}
        onUnlock={(role) => setUserRole(role)}
      />

      <ShiftModal
        opened={shiftModalOpened}
        mode={shiftModalMode}
        onClose={shiftModalHandlers.close}
        onOpenShift={handleOpenShift}
        onCloseShift={handleCloseShift}
        summary={{ ...shiftSummary, cashExpected: (activeShift?.initial_cash ?? 0) + (shiftSummary.byPayment.cash ?? 0) }}
        activeShift={activeShift}
        sales={sales}
        products={products}
      />

      <ClientModal
        opened={clientModalOpened}
        onClose={clientModalHandlers.close}
        onCreateClient={handleCreateClient}
      />

      <ReturnDrawer
        opened={returnDrawerOpened}
        onClose={returnDrawerHandlers.close}
        sales={sales.filter((sale) => sale.type === "sale")}
        value={returnSaleId}
        onSelectSale={setReturnSaleId}
        items={returnItems}
        onChangeItem={(itemId, quantity) =>
          setReturnItems((prev) => ({
            ...prev,
            [itemId]: Math.max(0, quantity)
          }))
        }
        reason={returnReason}
        onChangeReason={setReturnReason}
        refundMethod={returnRefundMethod}
        onChangeRefundMethod={setReturnRefundMethod}
        onConfirm={handleRegisterReturn}
      />

      <PaymentEditModal
        opened={Boolean(paymentEditSaleId)}
        sale={sales.find((sale) => sale.id === paymentEditSaleId) ?? null}
        onClose={() => setPaymentEditSaleId(null)}
        onSave={(method) => {
          if (!paymentEditSaleId) return;
          handleChangePaymentMethod(paymentEditSaleId, method);
        }}
      />

      <FiadoPaymentModal
        opened={fiadoModalOpened}
        client={clients.find((client) => client.id === fiadoModalClientId) ?? null}
        mode={fiadoModalMode}
        onClose={fiadoModalHandlers.close}
        onSubmit={({ amount, description }) => {
          if (!fiadoModalClientId) return;
          handleFiadoMovement({
            clientId: fiadoModalClientId,
            mode: fiadoModalMode,
            amount,
            description
          });
          fiadoModalHandlers.close();
        }}
      />

      <AddStockModal
        opened={addStockModalOpened}
        onClose={() => {
          addStockModalHandlers.close();
          setSelectedProductForStock(null);
        }}
        products={products}
        selectedProductId={selectedProductForStock}
        onConfirm={handleAddStock}
      />

      <EditProductModal
        opened={editProductModalOpened}
        onClose={() => {
          editProductModalHandlers.close();
          setSelectedProductForEdit(null);
        }}
        product={selectedProductForEdit}
        categories={Array.from(new Set(products.map((p) => p.category))).sort()}
        onSave={(productId, updates) => {
          if (productId) {
            handleEditProduct(productId, updates);
          } else {
            handleCreateProduct(updates as ProductInput);
          }
        }}
      />

      <DeleteProductModal
        opened={deleteProductModalOpened}
        product={selectedProductForDelete}
        onClose={() => {
          deleteProductModalHandlers.close();
          setSelectedProductForDelete(null);
        }}
        onConfirm={handleDeleteProduct}
      />

      <LowStockModal
        opened={lowStockModalOpened}
        onClose={lowStockModalHandlers.close}
        products={products}
      />
    </AppShell>
  );
};

type ProductInput = {
  name: string;
  category: string;
  barcode: string | null;
  price: number;
  stock: number;
  minStock: number;
};

// ================== INVENTORY COMPONENTS ==================

interface InventoryViewProps {
  products: Product[];
  search: string;
  onSearchChange: (value: string) => void;
  categoryFilter: string | null;
  onCategoryFilterChange: (value: string | null) => void;
  stockFilter: "all" | "low" | "out";
  onStockFilterChange: (value: "all" | "low" | "out") => void;
  onRefresh: () => void;
  onNewProduct: () => void;
  onAddStock: (productId: string) => void;
  onEditProduct: (product: Product) => void;
  onDeleteProduct: (product: Product) => void;
}

const InventoryView = ({
  products,
  search,
  onSearchChange,
  categoryFilter,
  onCategoryFilterChange,
  stockFilter,
  onStockFilterChange,
  onRefresh,
  onNewProduct,
  onAddStock,
  onEditProduct,
  onDeleteProduct
}: InventoryViewProps) => {
  const categories = useMemo(() => Array.from(new Set(products.map((p) => p.category))).sort(), [products]);

  const filteredProducts = useMemo(() => {
    let filtered = products;

    // Búsqueda
    if (search.trim()) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.name.toLowerCase().includes(searchLower) ||
          p.category.toLowerCase().includes(searchLower) ||
          p.barcode?.toLowerCase().includes(searchLower)
      );
    }

    // Filtro categoría
    if (categoryFilter) {
      filtered = filtered.filter((p) => p.category === categoryFilter);
    }

    // Filtro stock
    if (stockFilter === "low") {
      filtered = filtered.filter((p) => p.stock <= p.minStock && p.stock > 0);
    } else if (stockFilter === "out") {
      filtered = filtered.filter((p) => p.stock === 0);
    }

    return filtered;
  }, [products, search, categoryFilter, stockFilter]);

  const totalProducts = products.length;
  const totalValue = useMemo(() => products.reduce((acc, p) => acc + p.price * p.stock, 0), [products]);
  const lowStockCount = useMemo(() => products.filter((p) => p.stock <= p.minStock && p.stock > 0).length, [products]);
  const outStockCount = useMemo(() => products.filter((p) => p.stock === 0).length, [products]);

  return (
    <Stack gap="xl">
      {/* KPI Cards */}
      <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="lg">
        <Card
          withBorder
          radius="lg"
          style={{
            background: "linear-gradient(135deg, var(--mantine-color-teal-6), var(--mantine-color-teal-4))"
          }}
        >
          <Stack gap="xs">
            <Group justify="space-between">
              <Text size="sm" c="white" fw={500}>
                Total Productos
              </Text>
              <ThemeIcon color="white" variant="light" radius="xl">
                <Package size={20} />
              </ThemeIcon>
            </Group>
            <Title order={2} c="white">
              {totalProducts}
            </Title>
            <Text size="xs" c="white" opacity={0.9}>
              Productos registrados
            </Text>
          </Stack>
        </Card>

        <Card
          withBorder
          radius="lg"
          style={{
            background: "linear-gradient(135deg, var(--mantine-color-indigo-6), var(--mantine-color-indigo-4))"
          }}
        >
          <Stack gap="xs">
            <Group justify="space-between">
              <Text size="sm" c="white" fw={500}>
                Valor Total
              </Text>
              <ThemeIcon color="white" variant="light" radius="xl">
                <Coins size={20} />
              </ThemeIcon>
            </Group>
            <Title order={2} c="white">
              {formatCurrency(totalValue)}
            </Title>
            <Text size="xs" c="white" opacity={0.9}>
              Inventario valorizado
            </Text>
          </Stack>
        </Card>

        <Card
          withBorder
          radius="lg"
          style={{
            background: "linear-gradient(135deg, var(--mantine-color-orange-6), var(--mantine-color-orange-4))"
          }}
        >
          <Stack gap="xs">
            <Group justify="space-between">
              <Text size="sm" c="white" fw={500}>
                Stock Bajo
              </Text>
              <ThemeIcon color="white" variant="light" radius="xl">
                <AlertTriangle size={20} />
              </ThemeIcon>
            </Group>
            <Title order={2} c="white">
              {lowStockCount}
            </Title>
            <Text size="xs" c="white" opacity={0.9}>
              Productos con stock bajo
            </Text>
          </Stack>
        </Card>

        <Card
          withBorder
          radius="lg"
          style={{
            background: "linear-gradient(135deg, var(--mantine-color-red-6), var(--mantine-color-red-4))"
          }}
        >
          <Stack gap="xs">
            <Group justify="space-between">
              <Text size="sm" c="white" fw={500}>
                Sin Stock
              </Text>
              <ThemeIcon color="white" variant="light" radius="xl">
                <X size={20} />
              </ThemeIcon>
            </Group>
            <Title order={2} c="white">
              {outStockCount}
            </Title>
            <Text size="xs" c="white" opacity={0.9}>
              Productos agotados
            </Text>
          </Stack>
        </Card>
      </SimpleGrid>

      {/* Toolbar */}
      <Card withBorder radius="lg">
        <Stack gap="md">
          <Group justify="space-between">
            <Title order={3}>Control de Inventario</Title>
            <Group gap="sm">
              <Button
                variant="gradient"
                gradient={{ from: "teal", to: "cyan", deg: 90 }}
                leftSection={<Plus size={18} />}
                onClick={onNewProduct}
              >
                Nuevo Producto
              </Button>
              <Button variant="light" color="indigo" leftSection={<RefreshCcw size={18} />} onClick={onRefresh}>
                Sincronizar
              </Button>
            </Group>
          </Group>

          <Grid gutter="md">
            <Grid.Col span={{ base: 12, sm: 6, md: 4 }}>
              <TextInput
                placeholder="Buscar por nombre, categoría o código..."
                leftSection={<Search size={18} />}
                value={search}
                onChange={(e) => onSearchChange(e.currentTarget.value)}
                rightSection={
                  search ? (
                    <ActionIcon variant="subtle" color="gray" onClick={() => onSearchChange("")}>
                      <X size={16} />
                    </ActionIcon>
                  ) : null
                }
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6, md: 4 }}>
              <Select
                placeholder="Todas las categorías"
                leftSection={<Filter size={18} />}
                data={categories}
                value={categoryFilter}
                onChange={onCategoryFilterChange}
                clearable
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6, md: 4 }}>
              <Select
                placeholder="Estado de stock"
                data={[
                  { value: "all", label: "Todos" },
                  { value: "low", label: "Stock bajo" },
                  { value: "out", label: "Sin stock" }
                ]}
                value={stockFilter}
                onChange={(value) => onStockFilterChange(value as "all" | "low" | "out")}
              />
            </Grid.Col>
          </Grid>
        </Stack>
      </Card>

      {/* Vista de tarjetas de productos */}
      {filteredProducts.length === 0 ? (
        <Card withBorder radius="lg" p="xl">
          <Text ta="center" c="dimmed" size="lg">
            No se encontraron productos
          </Text>
        </Card>
      ) : (
        <SimpleGrid cols={{ base: 1, sm: 2, md: 3, lg: 4 }} spacing="md">
          {filteredProducts.map((product) => {
            let statusColor = "teal";
            let statusLabel = "Normal";

            if (product.stock === 0) {
              statusColor = "red";
              statusLabel = "BAJO STOCK";
            } else if (product.stock <= product.minStock) {
              statusColor = "orange";
              statusLabel = "BAJO STOCK";
            }

            return (
              <Card
                key={product.id}
                withBorder
                radius="lg"
                shadow="sm"
                p="md"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  height: "100%",
                  minHeight: "280px"
                }}
              >
                <Stack gap="xs" style={{ flex: 1 }}>
                  {/* Nombre del producto - altura fija */}
                  <Text
                    fw={600}
                    size="lg"
                    style={{
                      minHeight: "48px",
                      maxHeight: "48px",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                      lineHeight: "24px"
                    }}
                  >
                    {product.name}
                  </Text>

                  {/* Categoría */}
                  <Badge variant="light" color="indigo" size="sm">
                    {product.category}
                  </Badge>

                  <Divider />

                  {/* Precio destacado */}
                  <Group justify="space-between" align="center">
                    <Text size="xs" c="dimmed" fw={600}>
                      PRECIO
                    </Text>
                    <Text fw={700} size="xl" c="blue">
                      {formatCurrency(product.price)}
                    </Text>
                  </Group>

                  {/* Stock */}
                  <Group justify="space-between">
                    <Text size="sm" c="dimmed">
                      Stock actual: <Text span fw={600}>{product.stock}</Text>
                    </Text>
                    <Text size="sm" c="dimmed">
                      Mínimo: <Text span fw={600}>{product.minStock}</Text>
                    </Text>
                  </Group>

                  {/* Barra de progreso de stock */}
                  <Progress
                    value={product.minStock > 0 ? Math.min((product.stock / (product.minStock * 2)) * 100, 100) : 100}
                    color={product.stock === 0 ? "red" : product.stock <= product.minStock ? "orange" : "teal"}
                    size="sm"
                    radius="xl"
                  />

                  {/* Código de barras */}
                  <Text size="xs" c="dimmed">
                    {product.barcode ? `SKU: ${product.barcode}` : "Sin código asignado"}
                  </Text>

                  {/* Badge de estado */}
                  {(product.stock === 0 || product.stock <= product.minStock) && (
                    <Badge color={statusColor} variant="filled" fullWidth size="md">
                      {statusLabel}
                    </Badge>
                  )}

                  {/* Spacer para empujar botones al final */}
                  <div style={{ flex: 1 }} />

                  {/* Botones de acción */}
                  <Group gap="xs" grow>
                    <Button
                      variant="light"
                      color="teal"
                      size="sm"
                      leftSection={<Plus size={16} />}
                      onClick={() => onAddStock(product.id)}
                    >
                      Stock
                    </Button>
                    <Button
                      variant="light"
                      color="indigo"
                      size="sm"
                      leftSection={<Edit size={16} />}
                      onClick={() => onEditProduct(product)}
                    >
                      Editar
                    </Button>
                    <Button
                      variant="light"
                      color="red"
                      size="sm"
                      leftSection={<Trash2 size={16} />}
                      onClick={() => onDeleteProduct(product)}
                    >
                      Eliminar
                    </Button>
                  </Group>
                </Stack>
              </Card>
            );
          })}
        </SimpleGrid>
      )}
    </Stack>
  );
};

interface DashboardViewProps {
  products: Product[];
  sales: Sale[];
  clients: Client[];
  activeShift: Shift | undefined;
  shiftSummary: ShiftSummary;
  onEditSale: (saleId: string) => void;
}

const DashboardView = ({
  products,
  sales,
  clients,
  activeShift,
  shiftSummary,
  onEditSale
}: DashboardViewProps) => {
  const shiftSales = useMemo(() => {
    if (!activeShift) return [] as Sale[];
    return sales
      .filter((sale) => sale.shiftId === activeShift.id)
      .sort((a, b) => dayjs(b.created_at).valueOf() - dayjs(a.created_at).valueOf());
  }, [sales, activeShift]);

  const salesOnly = useMemo(() => shiftSales.filter((sale) => sale.type === "sale"), [shiftSales]);
  const returns = useMemo(() => shiftSales.filter((sale) => sale.type === "return"), [shiftSales]);
  const returnsTotal = useMemo(() => returns.reduce((acc, sale) => acc + sale.total, 0), [returns]);
  const fiadoTotal = useMemo(
    () => salesOnly.filter((sale) => sale.paymentMethod === "fiado").reduce((acc, sale) => acc + sale.total, 0),
    [salesOnly]
  );
  const staffTotal = useMemo(
    () => salesOnly.filter((sale) => sale.paymentMethod === "staff").reduce((acc, sale) => acc + sale.total, 0),
    [salesOnly]
  );

  const paymentData = Object.entries(shiftSummary.byPayment)
    .filter(([, value]) => value > 0)
    .map(([method, value]) => {
      const option = PAYMENT_OPTIONS.find((opt) => opt.id === method)!;
      return {
        name: option.label,
        value,
        method: method as PaymentMethod,
        color: PAYMENT_COLORS[method as PaymentMethod]
      };
    });

  const topProducts = useMemo(() => {
    const productSales = new Map<string, { name: string; quantity: number; revenue: number }>();
    salesOnly.forEach((sale) => {
      sale.items.forEach((item) => {
        const existing = productSales.get(item.productId) || { name: item.name, quantity: 0, revenue: 0 };
        productSales.set(item.productId, {
          name: item.name,
          quantity: existing.quantity + item.quantity,
          revenue: existing.revenue + item.price * item.quantity
        });
      });
    });
    return Array.from(productSales.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);
  }, [salesOnly]);

  const lowStockSnapshot = products
    .filter((product) => product.stock <= product.minStock)
    .sort((a, b) => a.stock - b.stock)
    .slice(0, 5);

  const clientsWithDebt = clients
    .filter((client) => client.balance > 0)
    .sort((a, b) => b.balance - a.balance)
    .slice(0, 5);

  const latestOperations = shiftSales.slice(0, 8);

  if (!activeShift) {
    const lowStockProducts = products.filter((product) => product.stock <= product.minStock).slice(0, 6);
    return (
      <Stack gap="lg">
        <Card withBorder radius="lg">
          <Stack gap="sm">
            <Title order={3}>Panel ejecutivo</Title>
            <Text c="dimmed">
              Aún no se registra un turno activo. Abre un turno desde la parte superior para comenzar a monitorear las ventas en tiempo real.
            </Text>
          </Stack>
        </Card>
        {lowStockProducts.length > 0 && (
          <Card withBorder radius="lg">
            <Stack gap="md">
              <Group justify="space-between">
                <Group gap="xs">
                  <AlertTriangle size={18} />
                  <Text fw={700}>Productos críticos</Text>
                </Group>
                <Badge color="orange" variant="light">
                  {lowStockProducts.length}
                </Badge>
              </Group>
              <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="sm">
                {lowStockProducts.map((product) => (
                  <Paper key={product.id} withBorder p="sm" radius="md">
                    <Stack gap={4}>
                      <Text fw={600} size="sm">{product.name}</Text>
                      <Text size="xs" c="dimmed">
                        Stock {product.stock} / Mínimo {product.minStock}
                      </Text>
                    </Stack>
                  </Paper>
                ))}
              </SimpleGrid>
            </Stack>
          </Card>
        )}
      </Stack>
    );
  }

  return (
    <Stack gap="lg">
      {activeShift && (
        <Card withBorder radius="lg" style={{ background: "linear-gradient(135deg, rgba(59,130,246,0.12), rgba(99,102,241,0.18))" }}>
          <Group justify="space-between" align="flex-start">
            <Stack gap={4}>
              <Text fw={700} fz="lg">
                Turno activo • {activeShift.seller}
              </Text>
              <Text size="sm" c="dimmed">
                {activeShift.type === "dia" ? "Turno diurno" : "Turno nocturno"} • Apertura {formatDateTime(activeShift.start)}
              </Text>
            </Stack>
            <Badge color="blue" variant="light">
              {shiftSales.length} movimientos
            </Badge>
          </Group>
        </Card>
      )}

      <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="md">
        <Paper withBorder radius="lg" p="md">
          <Stack gap={4}>
            <Text size="sm" c="dimmed">
              Total recaudado
            </Text>
            <Text fw={700} fz="xl">
              {formatCurrency(shiftSummary.total)}
            </Text>
            <Text size="xs" c="dimmed">
              Incluye devoluciones: {formatCurrency(returnsTotal)}
            </Text>
          </Stack>
        </Paper>
        <Paper withBorder radius="lg" p="md">
          <Stack gap={4}>
            <Text size="sm" c="dimmed">
              Tickets emitidos
            </Text>
            <Text fw={700} fz="xl">
              {salesOnly.length}
            </Text>
            <Text size="xs" c="dimmed">
              Devoluciones registradas: {returns.length}
            </Text>
          </Stack>
        </Paper>
        <Paper withBorder radius="lg" p="md">
          <Stack gap={4}>
            <Text size="sm" c="dimmed">
              Fiado del turno
            </Text>
            <Text fw={700} fz="xl">
              {formatCurrency(fiadoTotal)}
            </Text>
            <Text size="xs" c="dimmed">
              Controla los abonos desde la sección de fiados
            </Text>
          </Stack>
        </Paper>
        <Paper withBorder radius="lg" p="md">
          <Stack gap={4}>
            <Text size="sm" c="dimmed">
              Consumo interno
            </Text>
            <Text fw={700} fz="xl">
              {formatCurrency(staffTotal)}
            </Text>
            <Text size="xs" c="dimmed">
              Ventas registradas como consumo del personal
            </Text>
          </Stack>
        </Paper>
      </SimpleGrid>

      <Grid gutter="md">
        <Grid.Col span={{ base: 12, lg: 7 }}>
          <Card withBorder radius="lg">
            <Stack gap="md">
              <Group justify="space-between">
                <Text fw={700}>Movimientos del turno</Text>
                <Badge variant="light" color="indigo">
                  {latestOperations.length}
                </Badge>
              </Group>
              {latestOperations.length === 0 ? (
                <Text c="dimmed" ta="center">
                  Aún no hay ventas registradas en este turno.
                </Text>
              ) : (
                <ScrollArea h={260}>
                  <Table highlightOnHover>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>Ticket</Table.Th>
                        <Table.Th>Hora</Table.Th>
                        <Table.Th>Tipo</Table.Th>
                        <Table.Th>Método</Table.Th>
                        <Table.Th>Total</Table.Th>
                        <Table.Th>Acciones</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {latestOperations.map((sale) => {
                        const payment = PAYMENT_OPTIONS.find((option) => option.id === sale.paymentMethod);
                        return (
                          <Table.Tr key={sale.id}>
                            <Table.Td>#{sale.ticket}</Table.Td>
                            <Table.Td>{formatTime(sale.created_at)}</Table.Td>
                            <Table.Td>
                              <Badge color={sale.type === "sale" ? "teal" : "red"} variant="light">
                                {sale.type === "sale" ? "Venta" : "Devolución"}
                              </Badge>
                            </Table.Td>
                            <Table.Td>{payment?.label ?? sale.paymentMethod.toUpperCase()}</Table.Td>
                            <Table.Td>{formatCurrency(sale.total)}</Table.Td>
                            <Table.Td>
                              {sale.type === "sale" && (
                                <Button
                                  variant="light"
                                  size="xs"
                                  onClick={() => onEditSale(sale.id)}
                                >
                                  Ajustar método
                                </Button>
                              )}
                            </Table.Td>
                          </Table.Tr>
                        );
                      })}
                    </Table.Tbody>
                  </Table>
                </ScrollArea>
              )}
            </Stack>
          </Card>
        </Grid.Col>
        <Grid.Col span={{ base: 12, lg: 5 }}>
          <Card withBorder radius="lg">
            <Stack gap="md">
              <Text fw={700}>Cobros por método</Text>
              {paymentData.length === 0 ? (
                <Text c="dimmed" ta="center">
                  Registra ventas para visualizar el detalle.
                </Text>
              ) : (
                <div style={{ width: "100%", height: 220 }}>
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie data={paymentData} dataKey="value" nameKey="name" innerRadius={60} outerRadius={90} paddingAngle={4}>
                        {paymentData.map((entry) => (
                          <Cell key={entry.method} fill={entry.color} />
                        ))}
                      </Pie>
                      <ChartTooltip formatter={(value: number) => formatCurrency(value)} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
              <Stack gap="xs">
                {paymentData.map((entry) => (
                  <Group key={entry.method} justify="space-between">
                    <Text size="sm">{entry.name}</Text>
                    <Text fw={600} size="sm">
                      {formatCurrency(entry.value)}
                    </Text>
                  </Group>
                ))}
              </Stack>
            </Stack>
          </Card>
        </Grid.Col>
      </Grid>

      <Grid gutter="md">
        <Grid.Col span={{ base: 12, md: 6 }}>
          <Card withBorder radius="lg">
            <Stack gap="md">
              <Group gap="xs">
                <TrendingUp size={18} />
                <Text fw={700}>Top productos del turno</Text>
              </Group>
              {topProducts.length === 0 ? (
                <Text c="dimmed" ta="center">
                  Sin ventas registradas.
                </Text>
              ) : (
                <Stack gap="sm">
                  {topProducts.map((item, index) => (
                    <Group key={item.name} justify="space-between">
                      <Group gap="xs">
                        <Badge color="indigo" variant="light">
                          {index + 1}
                        </Badge>
                        <div>
                          <Text fw={600}>{item.name}</Text>
                          <Text size="xs" c="dimmed">{item.quantity} unidades</Text>
                        </div>
                      </Group>
                      <Text fw={700}>{formatCurrency(item.revenue)}</Text>
                    </Group>
                  ))}
                </Stack>
              )}
            </Stack>
          </Card>
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 6 }}>
          <Card withBorder radius="lg">
            <Stack gap="md">
              <Group gap="xs">
                <AlertTriangle size={18} />
                <Text fw={700}>Inventario a vigilar</Text>
              </Group>
              {lowStockSnapshot.length === 0 ? (
                <Text c="dimmed" ta="center">
                  Sin alertas de stock.
                </Text>
              ) : (
                <Stack gap="sm">
                  {lowStockSnapshot.map((product) => (
                    <Group key={product.id} justify="space-between">
                      <Text>{product.name}</Text>
                      <Badge color="orange" variant="light">
                        {product.stock} uds.
                      </Badge>
                    </Group>
                  ))}
                </Stack>
              )}
            </Stack>
          </Card>
        </Grid.Col>
      </Grid>

      <Card withBorder radius="lg">
        <Stack gap="md">
          <Group gap="xs">
            <PiggyBank size={18} />
            <Text fw={700}>Clientes con saldo pendiente</Text>
          </Group>
          {clientsWithDebt.length === 0 ? (
            <Text c="dimmed" ta="center">
              Sin deudas registradas.
            </Text>
          ) : (
            <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="sm">
              {clientsWithDebt.map((client) => (
                <Paper key={client.id} withBorder radius="md" p="sm">
                  <Stack gap={2}>
                    <Text fw={600} size="sm">{client.name}</Text>
                    <Text size="xs" c="dimmed">
                      Saldo: {formatCurrency(client.balance)}
                    </Text>
                  </Stack>
                </Paper>
              ))}
            </SimpleGrid>
          )}
        </Stack>
      </Card>
    </Stack>
  );
};

interface FiadosViewProps {
  clients: Client[];
  onAuthorize: (clientId: string, authorized: boolean) => void;
  onOpenModal: (clientId: string, mode: "abono" | "total") => void;
  onOpenClientModal: () => void;
}

const FiadosView = ({ clients, onAuthorize, onOpenModal, onOpenClientModal }: FiadosViewProps) => {
  const totalDebt = clients.reduce((acc, client) => acc + client.balance, 0);
  const authorizedCount = clients.filter((client) => client.authorized).length;
  const blockedCount = clients.length - authorizedCount;
  const topDebtors = clients
    .filter((client) => client.balance > 0)
    .sort((a, b) => b.balance - a.balance)
    .slice(0, 5);

  const movementTimeline =
    clients
      .flatMap((client) =>
        (client.history ?? []).map((item) => ({
          ...item,
          client: client.name
        }))
      )
      .sort((a, b) => dayjs(b.created_at).valueOf() - dayjs(a.created_at).valueOf());

  return (
    <Stack gap="xl">
      <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
        <Paper withBorder radius="lg" p="md" style={{ background: "linear-gradient(135deg, rgba(59,130,246,0.12), rgba(147,197,253,0.18))" }}>
          <Stack gap={4}>
            <Group gap="xs">
              <ThemeIcon color="indigo" variant="light">
                <UsersRound size={18} />
              </ThemeIcon>
              <Text size="sm" c="dimmed">
                Clientes autorizados
              </Text>
            </Group>
            <Text fw={700} fz="xl">{authorizedCount}</Text>
          </Stack>
        </Paper>
        <Paper withBorder radius="lg" p="md" style={{ background: "linear-gradient(135deg, rgba(248,113,113,0.12), rgba(251,191,36,0.18))" }}>
          <Stack gap={4}>
            <Group gap="xs">
              <ThemeIcon color="orange" variant="light">
                <AlertTriangle size={18} />
              </ThemeIcon>
              <Text size="sm" c="dimmed">
                Clientes bloqueados
              </Text>
            </Group>
            <Text fw={700} fz="xl">{blockedCount}</Text>
          </Stack>
        </Paper>
        <Paper withBorder radius="lg" p="md" style={{ background: "linear-gradient(135deg, rgba(16,185,129,0.12), rgba(45,212,191,0.18))" }}>
          <Stack gap={4}>
            <Group gap="xs">
              <ThemeIcon color="teal" variant="light">
                <PiggyBank size={18} />
              </ThemeIcon>
              <Text size="sm" c="dimmed">
                Deuda total
              </Text>
            </Group>
            <Text fw={700} fz="xl">{formatCurrency(totalDebt)}</Text>
          </Stack>
        </Paper>
      </SimpleGrid>

      <Card withBorder radius="lg">
        <Stack gap="md">
          <Group justify="space-between">
            <Title order={3}>Gestión de fiados</Title>
            <Group gap="sm">
              <Badge color="violet" variant="light">
                {authorizedCount} autorizados
              </Badge>
              <Button
                size="sm"
                leftSection={<UserPlus size={16} />}
                onClick={onOpenClientModal}
              >
                Nuevo cliente
              </Button>
            </Group>
          </Group>

          {/* Vista de tabla para desktop */}
          <Box visibleFrom="md">
            <ScrollArea h={460}>
              <Table highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Cliente</Table.Th>
                    <Table.Th>Estado</Table.Th>
                    <Table.Th>Límite</Table.Th>
                    <Table.Th>Saldo</Table.Th>
                    <Table.Th>Acciones</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {clients.map((client) => (
                    <Table.Tr key={client.id}>
                      <Table.Td>{client.name}</Table.Td>
                      <Table.Td>
                        <Badge color={client.authorized ? "teal" : "red"} variant="light">
                          {client.authorized ? "Autorizado" : "Bloqueado"}
                        </Badge>
                      </Table.Td>
                      <Table.Td>{formatCurrency(client.limit)}</Table.Td>
                      <Table.Td>
                        <Text fw={600} c={client.balance > 0 ? "red" : "teal"}>
                          {formatCurrency(client.balance)}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Group gap="xs">
                          <Button
                            size="xs"
                            variant="default"
                            onClick={() => onAuthorize(client.id, !client.authorized)}
                          >
                            {client.authorized ? "Bloquear" : "Autorizar"}
                          </Button>
                          <Button
                            size="xs"
                            variant="light"
                            leftSection={<Coins size={16} />}
                            onClick={() => onOpenModal(client.id, "abono")}
                            disabled={client.balance === 0}
                          >
                            Registrar abono
                          </Button>
                          <Button
                            size="xs"
                            variant="subtle"
                            leftSection={<PiggyBank size={16} />}
                            onClick={() => onOpenModal(client.id, "total")}
                            disabled={client.balance === 0}
                          >
                            Pago total
                          </Button>
                        </Group>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </ScrollArea>
          </Box>

          {/* Vista de tarjetas para mobile */}
          <Box hiddenFrom="md">
            <ScrollArea h={460}>
              <Stack gap="md">
                {clients.map((client) => (
                  <Card key={client.id} withBorder radius="lg" shadow="sm">
                    <Stack gap="md">
                      <Group justify="space-between" align="flex-start">
                        <Stack gap={4}>
                          <Text fw={700} size="lg">{client.name}</Text>
                          <Badge color={client.authorized ? "teal" : "red"} variant="light">
                            {client.authorized ? "Autorizado" : "Bloqueado"}
                          </Badge>
                        </Stack>
                        <Button
                          size="xs"
                          variant="default"
                          onClick={() => onAuthorize(client.id, !client.authorized)}
                        >
                          {client.authorized ? "Bloquear" : "Autorizar"}
                        </Button>
                      </Group>

                      <Divider />

                      <Group justify="space-between">
                        <Text size="sm" c="dimmed">Límite de crédito</Text>
                        <Text fw={600}>{formatCurrency(client.limit)}</Text>
                      </Group>

                      <Group justify="space-between">
                        <Text size="sm" c="dimmed">Saldo actual</Text>
                        <Text fw={700} size="lg" c={client.balance > 0 ? "red" : "teal"}>
                          {formatCurrency(client.balance)}
                        </Text>
                      </Group>

                      {client.balance > 0 && (
                        <>
                          <Divider />
                          <Group grow>
                            <Button
                              size="sm"
                              variant="light"
                              leftSection={<Coins size={16} />}
                              onClick={() => onOpenModal(client.id, "abono")}
                            >
                              Abono
                            </Button>
                            <Button
                              size="sm"
                              variant="light"
                              color="teal"
                              leftSection={<PiggyBank size={16} />}
                              onClick={() => onOpenModal(client.id, "total")}
                            >
                              Pago total
                            </Button>
                          </Group>
                        </>
                      )}
                    </Stack>
                  </Card>
                ))}
              </Stack>
            </ScrollArea>
          </Box>
        </Stack>
      </Card>

      <Grid gutter="md">
        <Grid.Col span={{ base: 12, md: 6 }}>
          <Card withBorder radius="lg">
            <Stack gap="md">
              <Group gap="xs">
                <TrendingUp size={18} />
                <Text fw={700}>Principales deudores</Text>
              </Group>
              {topDebtors.length === 0 ? (
                <Text c="dimmed" ta="center">
                  Todos los clientes están al día.
                </Text>
              ) : (
                <Stack gap="sm">
                  {topDebtors.map((client) => (
                    <Group key={client.id} justify="space-between">
                      <Text>{client.name}</Text>
                      <Text fw={600}>{formatCurrency(client.balance)}</Text>
                    </Group>
                  ))}
                </Stack>
              )}
            </Stack>
          </Card>
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 6 }}>
          <Card withBorder radius="lg">
            <Stack gap="md">
              <Group gap="xs">
                <Receipt size={18} />
                <Text fw={700}>Historial de movimientos</Text>
              </Group>
              {movementTimeline.length === 0 ? (
                <Text c="dimmed" ta="center">
                  Aún no registras movimientos de fiado.
                </Text>
              ) : (
                <ScrollArea h={240}>
                  <Stack gap="sm">
                    {movementTimeline.map((movement) => (
                      <Paper key={movement.id} withBorder radius="md" p="sm">
                        <Stack gap={2}>
                          <Group justify="space-between">
                            <Text fw={600}>{movement.client}</Text>
                            <Text size="xs" c="dimmed">
                              {formatDateTime(movement.created_at)}
                            </Text>
                          </Group>
                          <Text size="sm">{movement.description}</Text>
                          <Text size="xs" c="dimmed">
                            Saldo: {formatCurrency(movement.balance_after)}
                          </Text>
                        </Stack>
                      </Paper>
                    ))}
                  </Stack>
                </ScrollArea>
              )}
            </Stack>
          </Card>
        </Grid.Col>
      </Grid>
    </Stack>
  );
};

interface ReportsViewProps {
  filters: ReportFilters;
  onChangeFilters: (filters: ReportFilters) => void;
  summary: {
    total: number;
    tickets: number;
    byPayment: Record<PaymentMethod, number>;
    topProducts: { id: string; name: string; total: number; quantity: number }[];
    bySeller: { seller: string; total: number; tickets: number }[];
  };
}

const ReportsView = ({ filters, onChangeFilters, summary }: ReportsViewProps) => {
  const paymentData = Object.entries(summary.byPayment).map(([key, value]) => ({
    name: key.toUpperCase(),
    value
  }));

  const paymentChartData = paymentData.filter((item) => item.value > 0);

  return (
    <Stack gap="xl">
      <Card withBorder radius="lg">
        <Stack gap="md">
          <Group justify="space-between">
            <Title order={3}>Reportes de ventas</Title>
            <Group>
              <Select
                label="Rango rápido"
                data={REPORT_RANGES}
                value={filters.range}
                onChange={(value) => onChangeFilters({ ...filters, range: (value as ReportFilters["range"]) ?? "today" })}
              />
              {filters.range === "custom" && (
                <Group align="flex-end">
                  <TextInput
                    label="Desde"
                    placeholder="YYYY-MM-DD"
                    value={filters.from ?? ""}
                    onChange={(event) => onChangeFilters({ ...filters, from: event.currentTarget.value })}
                  />
                  <TextInput
                    label="Hasta"
                    placeholder="YYYY-MM-DD"
                    value={filters.to ?? ""}
                    onChange={(event) => onChangeFilters({ ...filters, to: event.currentTarget.value })}
                  />
                </Group>
              )}
            </Group>
          </Group>
          <SimpleGrid cols={{ base: 1, md: 3 }} spacing="md">
            <Paper withBorder p="md" radius="md">
              <Stack gap={4}>
                <Text c="dimmed">Total vendido</Text>
                <Text fw={700} size="xl">
                  {formatCurrency(summary.total)}
                </Text>
                <Badge color="teal" variant="light">
                  {summary.tickets} tickets
                </Badge>
              </Stack>
            </Paper>
            <Paper withBorder p="md" radius="md">
              <Stack gap={4}>
                <Text c="dimmed">Ticket promedio</Text>
                <Text fw={700} size="xl">
                  {summary.tickets === 0 ? formatCurrency(0) : formatCurrency(summary.total / summary.tickets)}
                </Text>
                <Badge color="indigo" variant="light">
                  Indicador general
                </Badge>
              </Stack>
            </Paper>
            <Paper withBorder p="md" radius="md">
              <Stack gap={4}>
                <Text c="dimmed">Efectivo controlado</Text>
                <Text fw={700} size="xl">
                  {formatCurrency(summary.byPayment.cash)}
                </Text>
                <Badge color="orange" variant="light">
                  Caja física
                </Badge>
              </Stack>
            </Paper>
          </SimpleGrid>
          <Grid gutter="xl">
            <Grid.Col span={{ base: 12, md: 6 }}>
              <Card withBorder radius="md" h={360}>
                <Stack gap="md" h="100%">
                  <Text fw={600}>Ventas por método de pago</Text>
                  {paymentChartData.length === 0 ? (
                    <Paper withBorder p="lg" radius="md">
                      <Text c="dimmed" ta="center">
                        No hay datos suficientes.
                      </Text>
                    </Paper>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={paymentChartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={110}>
                          {paymentChartData.map((entry) => (
                            <Cell key={entry.name} fill={PAYMENT_COLORS[entry.name.toLowerCase() as PaymentMethod]} />
                          ))}
                        </Pie>
                        <ChartTooltip formatter={(value: number) => formatCurrency(value)} />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </Stack>
              </Card>
            </Grid.Col>
            <Grid.Col span={{ base: 12, md: 6 }}>
              <Card withBorder radius="md" h={360}>
                <Stack gap="md" h="100%">
                  <Text fw={600}>Rendimiento por vendedor</Text>
                  {summary.bySeller.length === 0 ? (
                    <Paper withBorder p="lg" radius="md">
                      <Text c="dimmed" ta="center">
                        Aún no hay datos registrados.
                      </Text>
                    </Paper>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={summary.bySeller}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="seller" />
                        <YAxis tickFormatter={(value) => `${value / 1000}K`} />
                        <ChartTooltip formatter={(value: number) => formatCurrency(value)} />
                        <Bar dataKey="total" fill="#4263eb" radius={[8, 8, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </Stack>
              </Card>
            </Grid.Col>
          </Grid>
          <Card withBorder radius="md">
            <Stack gap="md">
              <Group justify="space-between">
                <Text fw={600}>Top 20 productos más vendidos</Text>
                <Badge color="indigo" variant="light">
                  Actualizado
                </Badge>
              </Group>
              <ScrollArea h={280}>
                <Table striped highlightOnHover>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Producto</Table.Th>
                      <Table.Th>Cantidad</Table.Th>
                      <Table.Th>Total</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {summary.topProducts.map((product) => (
                      <Table.Tr key={product.id}>
                        <Table.Td>{product.name}</Table.Td>
                        <Table.Td>{product.quantity}</Table.Td>
                        <Table.Td>{formatCurrency(product.total)}</Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </ScrollArea>
            </Stack>
          </Card>
        </Stack>
      </Card>
    </Stack>
  );
};

interface ShiftsViewProps {
  activeShift: Shift | undefined;
  summary: ShiftSummary;
  history: Shift[];
  sales: Sale[];
  products: Product[];
}

const ShiftsView = ({ activeShift, summary, history, sales, products }: ShiftsViewProps) => {
  const closedCount = history.length;
  const totalSales = history.reduce((acc, shift) => acc + (shift.total_sales ?? 0), 0);
  const totalDifferences = history.reduce((acc, shift) => acc + (shift.difference ?? 0), 0);
  const averageSales = closedCount > 0 ? totalSales / closedCount : 0;

  // Función para obtener productos vendidos por turno
  const getShiftProducts = (shiftId: string) => {
    const shiftSales = sales.filter((sale) => sale.shiftId === shiftId && sale.type === "sale");
    const productMap = new Map<string, { name: string; quantity: number; total: number }>();

    shiftSales.forEach((sale) => {
      sale.items.forEach((item) => {
        const existing = productMap.get(item.productId);
        if (existing) {
          existing.quantity += item.quantity;
          existing.total += item.price * item.quantity;
        } else {
          productMap.set(item.productId, {
            name: item.name,
            quantity: item.quantity,
            total: item.price * item.quantity
          });
        }
      });
    });

    return Array.from(productMap.values()).sort((a, b) => b.total - a.total);
  };

  return (
    <Stack gap="xl">
      {/* KPIs */}
      <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="lg">
        <Card
          withBorder
          radius="lg"
          style={{
            background: "linear-gradient(135deg, var(--mantine-color-indigo-6), var(--mantine-color-indigo-4))"
          }}
        >
          <Stack gap="xs">
            <Group justify="space-between">
              <Text size="sm" c="white" fw={500}>
                Turnos Cerrados
              </Text>
              <ThemeIcon color="white" variant="light" radius="xl">
                <BarChart3 size={20} />
              </ThemeIcon>
            </Group>
            <Title order={2} c="white">
              {closedCount}
            </Title>
            <Text size="xs" c="white" opacity={0.9}>
              Historial completo
            </Text>
          </Stack>
        </Card>

        <Card
          withBorder
          radius="lg"
          style={{
            background: "linear-gradient(135deg, var(--mantine-color-teal-6), var(--mantine-color-teal-4))"
          }}
        >
          <Stack gap="xs">
            <Group justify="space-between">
              <Text size="sm" c="white" fw={500}>
                Ventas Promedio
              </Text>
              <ThemeIcon color="white" variant="light" radius="xl">
                <TrendingUp size={20} />
              </ThemeIcon>
            </Group>
            <Title order={2} c="white">
              {formatCurrency(averageSales)}
            </Title>
            <Text size="xs" c="white" opacity={0.9}>
              Por turno
            </Text>
          </Stack>
        </Card>

        <Card
          withBorder
          radius="lg"
          style={{
            background: "linear-gradient(135deg, var(--mantine-color-violet-6), var(--mantine-color-violet-4))"
          }}
        >
          <Stack gap="xs">
            <Group justify="space-between">
              <Text size="sm" c="white" fw={500}>
                Total Acumulado
              </Text>
              <ThemeIcon color="white" variant="light" radius="xl">
                <DollarSign size={20} />
              </ThemeIcon>
            </Group>
            <Title order={2} c="white">
              {formatCurrency(totalSales)}
            </Title>
            <Text size="xs" c="white" opacity={0.9}>
              Todos los turnos
            </Text>
          </Stack>
        </Card>

        <Card
          withBorder
          radius="lg"
          style={{
            background: `linear-gradient(135deg, ${
              totalDifferences === 0
                ? "var(--mantine-color-gray-6), var(--mantine-color-gray-4)"
                : totalDifferences > 0
                ? "var(--mantine-color-green-6), var(--mantine-color-green-4)"
                : "var(--mantine-color-orange-6), var(--mantine-color-orange-4)"
            })`
          }}
        >
          <Stack gap="xs">
            <Group justify="space-between">
              <Text size="sm" c="white" fw={500}>
                Diferencia Total
              </Text>
              <ThemeIcon color="white" variant="light" radius="xl">
                <Wallet size={20} />
              </ThemeIcon>
            </Group>
            <Title order={2} c="white">
              {formatCurrency(totalDifferences)}
            </Title>
            <Text size="xs" c="white" opacity={0.9}>
              {totalDifferences === 0 ? "Exacto" : totalDifferences > 0 ? "Sobrante" : "Faltante"}
            </Text>
          </Stack>
        </Card>
      </SimpleGrid>

      {/* Turno activo */}
      <Card withBorder radius="lg">
        <Stack gap="md">
          <Group justify="space-between">
            <Title order={3}>Turno en curso</Title>
            {activeShift && (
              <Badge color="teal" variant="dot" size="lg">
                ACTIVO
              </Badge>
            )}
          </Group>
          {activeShift ? (
            <Paper
              withBorder
              p="lg"
              radius="md"
              style={{ background: "linear-gradient(135deg, rgba(13,148,136,0.08), rgba(45,212,191,0.12))" }}
            >
              <Stack gap="md">
                <Group justify="space-between">
                  <Group gap="sm">
                    <ThemeIcon color="teal" variant="light" size="lg">
                      <User size={20} />
                    </ThemeIcon>
                    <div>
                      <Text fw={700} size="lg">
                        {activeShift.seller}
                      </Text>
                      <Text size="sm" c="dimmed">
                        Turno {activeShift.type === "dia" ? "día" : "noche"}
                      </Text>
                    </div>
                  </Group>
                  <Badge color="teal" variant="light" size="lg">
                    <Clock3 size={14} style={{ marginRight: 4 }} />
                    {formatDateTime(activeShift.start)}
                  </Badge>
                </Group>

                <Divider />

                <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
                  <Paper withBorder p="sm" radius="md">
                    <Stack gap={4}>
                      <Text size="xs" c="dimmed">
                        TOTAL VENTAS
                      </Text>
                      <Text fw={700} size="xl">
                        {formatCurrency(summary.total)}
                      </Text>
                      <Text size="xs" c="dimmed">
                        {summary.tickets} tickets
                      </Text>
                    </Stack>
                  </Paper>
                  <Paper withBorder p="sm" radius="md">
                    <Stack gap={4}>
                      <Text size="xs" c="dimmed">
                        EFECTIVO EN CAJA
                      </Text>
                      <Text fw={700} size="xl" c="teal">
                        {formatCurrency((activeShift.initial_cash ?? 0) + (summary.byPayment.cash ?? 0))}
                      </Text>
                      <Text size="xs" c="dimmed">
                        Inicial: {formatCurrency(activeShift.initial_cash ?? 0)}
                      </Text>
                    </Stack>
                  </Paper>
                  <Paper withBorder p="sm" radius="md">
                    <Stack gap={4}>
                      <Text size="xs" c="dimmed">
                        TICKET PROMEDIO
                      </Text>
                      <Text fw={700} size="xl">
                        {summary.tickets > 0 ? formatCurrency(summary.total / summary.tickets) : formatCurrency(0)}
                      </Text>
                      <Text size="xs" c="dimmed">
                        Por venta
                      </Text>
                    </Stack>
                  </Paper>
                </SimpleGrid>

                <Paper withBorder p="sm" radius="md">
                  <Stack gap="xs">
                    <Text size="sm" fw={600} c="dimmed">
                      DESGLOSE POR MÉTODO DE PAGO
                    </Text>
                    <Grid gutter="xs">
                      {Object.entries(summary.byPayment).map(([method, value]) => (
                        <Grid.Col key={method} span={6}>
                          <Group justify="space-between">
                            <Text size="sm">{PAYMENT_LABELS[method as PaymentMethod]}</Text>
                            <Text fw={600}>{formatCurrency(value)}</Text>
                          </Group>
                        </Grid.Col>
                      ))}
                    </Grid>
                  </Stack>
                </Paper>
              </Stack>
            </Paper>
          ) : (
            <Paper withBorder p="xl" radius="md">
              <Stack gap="sm" align="center">
                <ThemeIcon color="gray" variant="light" size="xl">
                  <Clock3 size={28} />
                </ThemeIcon>
                <Text c="dimmed" ta="center" fw={500}>
                  No hay turnos activos
                </Text>
                <Text c="dimmed" ta="center" size="sm">
                  Inicia un turno desde el encabezado para comenzar a registrar ventas
                </Text>
              </Stack>
            </Paper>
          )}
        </Stack>
      </Card>

      {/* Historial de turnos */}
      <Card withBorder radius="lg">
        <Stack gap="md">
          <Group justify="space-between">
            <Title order={3}>Historial de turnos cerrados</Title>
            <Badge color="indigo" variant="light" size="lg">
              {history.length} turnos registrados
            </Badge>
          </Group>

          {history.length === 0 ? (
            <Paper withBorder p="xl" radius="md">
              <Stack gap="sm" align="center">
                <ThemeIcon color="gray" variant="light" size="xl">
                  <BarChart3 size={28} />
                </ThemeIcon>
                <Text c="dimmed" ta="center" fw={500}>
                  Aún no hay turnos cerrados
                </Text>
                <Text c="dimmed" ta="center" size="sm">
                  Los turnos cerrados aparecerán aquí con su información detallada
                </Text>
              </Stack>
            </Paper>
          ) : (
            <Accordion variant="separated" radius="md">
              {history.map((shift) => {
                const shiftProducts = getShiftProducts(shift.id);
                const diffAmount = shift.difference ?? 0;

                return (
                  <Accordion.Item key={shift.id} value={shift.id}>
                    <Accordion.Control>
                      <Group justify="space-between" wrap="nowrap">
                        <Group gap="md">
                          <ThemeIcon
                            color={shift.type === "dia" ? "blue" : "violet"}
                            variant="light"
                            size="lg"
                            radius="md"
                          >
                            <User size={20} />
                          </ThemeIcon>
                          <div>
                            <Text fw={700}>{shift.seller}</Text>
                            <Text size="sm" c="dimmed">
                              Turno {shift.type === "dia" ? "día" : "noche"}
                            </Text>
                          </div>
                        </Group>
                        <Group gap="sm">
                          <Badge color="gray" variant="light">
                            {shift.tickets ?? 0} tickets
                          </Badge>
                          <Badge color="teal" variant="light">
                            {formatCurrency(shift.total_sales ?? 0)}
                          </Badge>
                          <Badge
                            color={diffAmount === 0 ? "gray" : diffAmount > 0 ? "green" : "orange"}
                            variant="filled"
                          >
                            {diffAmount === 0 ? "Exacto" : diffAmount > 0 ? `+${formatCurrency(diffAmount)}` : formatCurrency(diffAmount)}
                          </Badge>
                        </Group>
                      </Group>
                    </Accordion.Control>
                    <Accordion.Panel>
                      <Stack gap="lg">
                        {/* Información del turno */}
                        <Paper withBorder p="md" radius="md" style={{ background: "rgba(99,102,241,0.03)" }}>
                          <Grid gutter="md">
                            <Grid.Col span={{ base: 12, sm: 6 }}>
                              <Stack gap="xs">
                                <Group gap="xs">
                                  <Clock3 size={16} style={{ color: "var(--mantine-color-dimmed)" }} />
                                  <Text size="sm" c="dimmed" fw={600}>
                                    HORARIO
                                  </Text>
                                </Group>
                                <Text size="sm">
                                  <strong>Inicio:</strong> {formatDateTime(shift.start)}
                                </Text>
                                <Text size="sm">
                                  <strong>Cierre:</strong> {shift.end ? formatDateTime(shift.end) : "-"}
                                </Text>
                              </Stack>
                            </Grid.Col>
                            <Grid.Col span={{ base: 12, sm: 6 }}>
                              <Stack gap="xs">
                                <Group gap="xs">
                                  <User size={16} style={{ color: "var(--mantine-color-dimmed)" }} />
                                  <Text size="sm" c="dimmed" fw={600}>
                                    VENDEDOR
                                  </Text>
                                </Group>
                                <Text size="sm">
                                  <strong>Nombre:</strong> {shift.seller}
                                </Text>
                                <Text size="sm">
                                  <strong>Turno:</strong> {shift.type === "dia" ? "Día" : "Noche"}
                                </Text>
                              </Stack>
                            </Grid.Col>
                          </Grid>
                        </Paper>

                        {/* Resumen financiero */}
                        <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} spacing="md">
                          <Paper withBorder p="md" radius="md">
                            <Stack gap={4}>
                              <Text size="xs" c="dimmed" fw={600}>
                                EFECTIVO INICIAL
                              </Text>
                              <Text fw={700} size="lg">
                                {formatCurrency(shift.initial_cash ?? 0)}
                              </Text>
                            </Stack>
                          </Paper>
                          <Paper withBorder p="md" radius="md">
                            <Stack gap={4}>
                              <Text size="xs" c="dimmed" fw={600}>
                                EFECTIVO ESPERADO
                              </Text>
                              <Text fw={700} size="lg">
                                {formatCurrency(shift.cash_expected ?? 0)}
                              </Text>
                            </Stack>
                          </Paper>
                          <Paper withBorder p="md" radius="md">
                            <Stack gap={4}>
                              <Text size="xs" c="dimmed" fw={600}>
                                EFECTIVO CONTADO
                              </Text>
                              <Text fw={700} size="lg">
                                {formatCurrency(shift.cash_counted ?? 0)}
                              </Text>
                            </Stack>
                          </Paper>
                          <Paper withBorder p="md" radius="md">
                            <Stack gap={4}>
                              <Text size="xs" c="dimmed" fw={600}>
                                DIFERENCIA
                              </Text>
                              <Text
                                fw={700}
                                size="lg"
                                c={diffAmount === 0 ? "gray" : diffAmount > 0 ? "green" : "orange"}
                              >
                                {formatCurrency(diffAmount)}
                              </Text>
                            </Stack>
                          </Paper>
                        </SimpleGrid>

                        {/* Desglose por método de pago */}
                        {shift.payments_breakdown && (
                          <Paper withBorder p="md" radius="md">
                            <Stack gap="sm">
                              <Group gap="xs">
                                <Wallet size={18} style={{ color: "var(--mantine-color-dimmed)" }} />
                                <Text fw={600}>Desglose por método de pago</Text>
                              </Group>
                              <Grid gutter="md">
                                {Object.entries(shift.payments_breakdown).map(([method, value]) => (
                                  <Grid.Col key={method} span={{ base: 6, sm: 4, md: 3 }}>
                                    <Paper withBorder p="xs" radius="sm">
                                      <Stack gap={4}>
                                        <Text size="xs" c="dimmed">
                                          {PAYMENT_LABELS[method as PaymentMethod]}
                                        </Text>
                                        <Text fw={600}>{formatCurrency(value)}</Text>
                                      </Stack>
                                    </Paper>
                                  </Grid.Col>
                                ))}
                              </Grid>
                            </Stack>
                          </Paper>
                        )}

                        {/* Productos vendidos */}
                        {shiftProducts.length > 0 && (
                          <Paper withBorder p="md" radius="md">
                            <Stack gap="sm">
                              <Group gap="xs">
                                <ShoppingBag size={18} style={{ color: "var(--mantine-color-dimmed)" }} />
                                <Text fw={600}>Productos vendidos ({shiftProducts.length})</Text>
                              </Group>
                              <ScrollArea h={300}>
                                <Table highlightOnHover>
                                  <Table.Thead>
                                    <Table.Tr>
                                      <Table.Th>Producto</Table.Th>
                                      <Table.Th>Cantidad</Table.Th>
                                      <Table.Th>Total</Table.Th>
                                    </Table.Tr>
                                  </Table.Thead>
                                  <Table.Tbody>
                                    {shiftProducts.map((product, idx) => (
                                      <Table.Tr key={idx}>
                                        <Table.Td>
                                          <Text fw={500}>{product.name}</Text>
                                        </Table.Td>
                                        <Table.Td>
                                          <Badge color="blue" variant="light">
                                            {product.quantity} unidades
                                          </Badge>
                                        </Table.Td>
                                        <Table.Td>
                                          <Text fw={600}>{formatCurrency(product.total)}</Text>
                                        </Table.Td>
                                      </Table.Tr>
                                    ))}
                                  </Table.Tbody>
                                </Table>
                              </ScrollArea>
                            </Stack>
                          </Paper>
                        )}
                      </Stack>
                    </Accordion.Panel>
                  </Accordion.Item>
                );
              })}
            </Accordion>
          )}
        </Stack>
      </Card>
    </Stack>
  );
};

export default App;
