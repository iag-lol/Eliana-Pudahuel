import { useEffect, useMemo, useState } from "react";
import {
    ActionIcon,
    Badge,
    Box,
    Button,
    Card,
    Divider,
    Drawer,
    Grid,
    Group,
    Paper,
    ScrollArea,
    Select,
    SimpleGrid,
    Stack,
    Table,
    Text,
    TextInput,
    ThemeIcon,
    Title,
    Tooltip
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import dayjs from "dayjs";
import {
    AlertTriangle,
    Calendar,
    Coins,
    Eye,
    FileDown,
    PiggyBank,
    Receipt,
    Search,
    TrendingUp,
    UserPlus,
    UsersRound,
    X
} from "lucide-react";
import type { Client, ClientMovement, PaymentSchedule } from "../types";
import { formatCurrency, formatDateTime } from "../utils/format";
import { generateClientReport, generateSummaryReport } from "../utils/pdfGenerator";

export interface FiadosViewProps {
    clients: Client[];
    onAuthorize: (clientId: string, authorized: boolean) => void;
    onOpenModal: (clientId: string, mode: "abono" | "total") => void;
    onOpenClientModal: () => void;
    onUpdatePaymentSchedule?: (clientId: string, schedule: PaymentSchedule) => void;
}

const PAYMENT_SCHEDULE_OPTIONS: { value: PaymentSchedule; label: string; description: string }[] = [
    { value: "immediate", label: "Inmediato", description: "Pago al momento" },
    { value: "biweekly", label: "Quincenal", description: "Pago cada quincena" },
    { value: "monthly", label: "Fin de Mes", description: "Pago a fin de mes" }
];

const getPaymentScheduleLabel = (schedule?: PaymentSchedule): string => {
    switch (schedule) {
        case "biweekly": return "Quincenal";
        case "monthly": return "Fin de Mes";
        case "immediate":
        default: return "Inmediato";
    }
};

const getPaymentScheduleColor = (schedule?: PaymentSchedule): string => {
    switch (schedule) {
        case "biweekly": return "violet";
        case "monthly": return "indigo";
        case "immediate":
        default: return "teal";
    }
};

export const FiadosViewEnhanced = ({
    clients,
    onAuthorize,
    onOpenModal,
    onOpenClientModal,
    onUpdatePaymentSchedule
}: FiadosViewProps) => {
    const [drawerOpened, { open: openDrawer, close: closeDrawer }] = useDisclosure(false);
    const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
    const [dateFrom, setDateFrom] = useState<Date | null>(null);
    const [dateTo, setDateTo] = useState<Date | null>(null);
    const [searchQuery, setSearchQuery] = useState("");

    // Get the selected client from the fresh clients array to ensure history is up-to-date
    const selectedClient = useMemo(() => {
        if (!selectedClientId) return null;
        return clients.find(c => c.id === selectedClientId) ?? null;
    }, [clients, selectedClientId]);

    const totalDebt = clients.reduce((acc, client) => acc + client.balance, 0);
    const authorizedCount = clients.filter((client) => client.authorized).length;
    const blockedCount = clients.length - authorizedCount;
    const topDebtors = clients
        .filter((client) => client.balance > 0)
        .sort((a, b) => b.balance - a.balance)
        .slice(0, 5);

    const scheduleStats = useMemo(() => ({
        immediate: clients.filter(c => !c.payment_schedule || c.payment_schedule === "immediate").length,
        biweekly: clients.filter(c => c.payment_schedule === "biweekly").length,
        monthly: clients.filter(c => c.payment_schedule === "monthly").length
    }), [clients]);

    const filteredClients = useMemo(() => {
        if (!searchQuery.trim()) return clients;
        const query = searchQuery.toLowerCase();
        return clients.filter(c => c.name.toLowerCase().includes(query));
    }, [clients, searchQuery]);

    const filteredMovements = useMemo(() => {
        if (!selectedClient?.history) return [];
        return selectedClient.history.filter(movement => {
            const movementDate = dayjs(movement.created_at);
            if (dateFrom && movementDate.isBefore(dayjs(dateFrom).startOf("day"))) return false;
            if (dateTo && movementDate.isAfter(dayjs(dateTo).endOf("day"))) return false;
            return true;
        }).sort((a, b) => dayjs(b.created_at).valueOf() - dayjs(a.created_at).valueOf());
    }, [selectedClient, dateFrom, dateTo]);

    const periodSummary = useMemo(() => {
        const totalFiado = filteredMovements
            .filter(m => m.type === "fiado")
            .reduce((sum, m) => sum + m.amount, 0);
        const totalAbonos = filteredMovements
            .filter(m => m.type === "abono" || m.type === "pago-total")
            .reduce((sum, m) => sum + m.amount, 0);
        return { totalFiado, totalAbonos, count: filteredMovements.length };
    }, [filteredMovements]);

    const totalPendiente = useMemo(() => {
        if (!selectedClient?.history) return 0;
        return selectedClient.history
            .filter(m => m.type === "fiado")
            .reduce((sum, m) => sum + m.amount, 0);
    }, [selectedClient]);

    const movementTimeline = clients
        .flatMap((client) =>
            (client.history ?? []).map((item) => ({
                ...item,
                client: client.name
            }))
        )
        .sort((a, b) => dayjs(b.created_at).valueOf() - dayjs(a.created_at).valueOf())
        .slice(0, 10);

    const handleOpenClientDetail = (client: Client) => {
        setSelectedClientId(client.id);
        setDateFrom(null);
        setDateTo(null);
        openDrawer();
    };

    const handleQuickDateRange = (range: "biweekly" | "month" | "lastMonth") => {
        const now = dayjs();
        switch (range) {
            case "biweekly": {
                const dayOfMonth = now.date();
                if (dayOfMonth <= 15) {
                    setDateFrom(now.startOf("month").toDate());
                    setDateTo(now.date(15).endOf("day").toDate());
                } else {
                    setDateFrom(now.date(16).startOf("day").toDate());
                    setDateTo(now.endOf("month").toDate());
                }
                break;
            }
            case "month":
                setDateFrom(now.startOf("month").toDate());
                setDateTo(now.endOf("month").toDate());
                break;
            case "lastMonth":
                setDateFrom(now.subtract(1, "month").startOf("month").toDate());
                setDateTo(now.subtract(1, "month").endOf("month").toDate());
                break;
        }
    };

    const handleGenerateClientPdf = () => {
        if (!selectedClient) return;
        generateClientReport({
            client: selectedClient,
            movements: filteredMovements,
            dateFrom,
            dateTo
        });
        notifications.show({
            title: "PDF generado",
            message: `El reporte de ${selectedClient.name} se ha descargado.`,
            color: "teal"
        });
    };

    const handleGenerateSummaryPdf = () => {
        generateSummaryReport({ clients, dateFrom, dateTo });
        notifications.show({
            title: "PDF generado",
            message: "El resumen general se ha descargado.",
            color: "teal"
        });
    };

    return (
        <>
            <Stack gap="xl">
                {/* KPI Cards */}
                <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="md">
                    <Paper withBorder radius="lg" p="md" style={{ background: "linear-gradient(135deg, rgba(59,130,246,0.12), rgba(147,197,253,0.18))" }}>
                        <Stack gap={4}>
                            <Group gap="xs">
                                <ThemeIcon color="indigo" variant="light">
                                    <UsersRound size={18} />
                                </ThemeIcon>
                                <Text size="sm" c="dimmed">Clientes autorizados</Text>
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
                                <Text size="sm" c="dimmed">Clientes bloqueados</Text>
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
                                <Text size="sm" c="dimmed">Deuda total</Text>
                            </Group>
                            <Text fw={700} fz="xl">{formatCurrency(totalDebt)}</Text>
                        </Stack>
                    </Paper>
                    <Paper withBorder radius="lg" p="md" style={{ background: "linear-gradient(135deg, rgba(139,92,246,0.12), rgba(196,181,253,0.18))" }}>
                        <Stack gap={4}>
                            <Group gap="xs">
                                <ThemeIcon color="violet" variant="light">
                                    <Calendar size={18} />
                                </ThemeIcon>
                                <Text size="sm" c="dimmed">Por modalidad</Text>
                            </Group>
                            <Group gap="xs">
                                <Badge variant="light" color="teal" size="sm">{scheduleStats.immediate} inm.</Badge>
                                <Badge variant="light" color="violet" size="sm">{scheduleStats.biweekly} quin.</Badge>
                                <Badge variant="light" color="indigo" size="sm">{scheduleStats.monthly} mes</Badge>
                            </Group>
                        </Stack>
                    </Paper>
                </SimpleGrid>

                {/* Main Card */}
                <Card withBorder radius="lg">
                    <Stack gap="md">
                        <Group justify="space-between" wrap="wrap">
                            <Title order={3}>Gestión de fiados</Title>
                            <Group gap="sm">
                                <Button
                                    size="sm"
                                    variant="light"
                                    color="indigo"
                                    leftSection={<FileDown size={16} />}
                                    onClick={handleGenerateSummaryPdf}
                                >
                                    Informe General PDF
                                </Button>
                                <Button
                                    size="sm"
                                    leftSection={<UserPlus size={16} />}
                                    onClick={onOpenClientModal}
                                >
                                    Nuevo cliente
                                </Button>
                            </Group>
                        </Group>

                        {/* Search */}
                        <TextInput
                            placeholder="Buscar cliente..."
                            leftSection={<Search size={16} />}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.currentTarget.value)}
                            rightSection={searchQuery ? (
                                <ActionIcon variant="subtle" onClick={() => setSearchQuery("")}>
                                    <X size={14} />
                                </ActionIcon>
                            ) : null}
                        />

                        {/* Desktop Table */}
                        <Box visibleFrom="md">
                            <ScrollArea h={460}>
                                <Table highlightOnHover>
                                    <Table.Thead>
                                        <Table.Tr>
                                            <Table.Th>Cliente</Table.Th>
                                            <Table.Th>Estado</Table.Th>
                                            <Table.Th>Modalidad</Table.Th>
                                            <Table.Th>Límite</Table.Th>
                                            <Table.Th>Saldo</Table.Th>
                                            <Table.Th>Acciones</Table.Th>
                                        </Table.Tr>
                                    </Table.Thead>
                                    <Table.Tbody>
                                        {filteredClients.map((client) => (
                                            <Table.Tr key={client.id}>
                                                <Table.Td>
                                                    <Text fw={500}>{client.name}</Text>
                                                </Table.Td>
                                                <Table.Td>
                                                    <Badge color={client.authorized ? "teal" : "red"} variant="light">
                                                        {client.authorized ? "Autorizado" : "Bloqueado"}
                                                    </Badge>
                                                </Table.Td>
                                                <Table.Td>
                                                    <Badge color={getPaymentScheduleColor(client.payment_schedule)} variant="light">
                                                        {getPaymentScheduleLabel(client.payment_schedule)}
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
                                                        <Tooltip label="Ver detalle y generar informe">
                                                            <ActionIcon
                                                                variant="light"
                                                                color="indigo"
                                                                onClick={() => handleOpenClientDetail(client)}
                                                            >
                                                                <Eye size={16} />
                                                            </ActionIcon>
                                                        </Tooltip>
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
                                                            leftSection={<Coins size={14} />}
                                                            onClick={() => onOpenModal(client.id, "abono")}
                                                            disabled={client.balance === 0}
                                                        >
                                                            Abono
                                                        </Button>
                                                        <Button
                                                            size="xs"
                                                            variant="subtle"
                                                            color="teal"
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

                        {/* Mobile Cards */}
                        <Box hiddenFrom="md">
                            <ScrollArea h={460}>
                                <Stack gap="md">
                                    {filteredClients.map((client) => (
                                        <Card key={client.id} withBorder radius="lg" shadow="sm">
                                            <Stack gap="md">
                                                <Group justify="space-between" align="flex-start">
                                                    <Stack gap={4}>
                                                        <Text fw={700} size="lg">{client.name}</Text>
                                                        <Group gap="xs">
                                                            <Badge color={client.authorized ? "teal" : "red"} variant="light" size="sm">
                                                                {client.authorized ? "Autorizado" : "Bloqueado"}
                                                            </Badge>
                                                            <Badge color={getPaymentScheduleColor(client.payment_schedule)} variant="light" size="sm">
                                                                {getPaymentScheduleLabel(client.payment_schedule)}
                                                            </Badge>
                                                        </Group>
                                                    </Stack>
                                                    <ActionIcon
                                                        variant="light"
                                                        color="indigo"
                                                        size="lg"
                                                        onClick={() => handleOpenClientDetail(client)}
                                                    >
                                                        <Eye size={18} />
                                                    </ActionIcon>
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

                                                <Divider />
                                                <Group grow>
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
                                                        leftSection={<Coins size={14} />}
                                                        onClick={() => onOpenModal(client.id, "abono")}
                                                        disabled={client.balance === 0}
                                                    >
                                                        Abono
                                                    </Button>
                                                    <Button
                                                        size="xs"
                                                        variant="light"
                                                        color="teal"
                                                        onClick={() => onOpenModal(client.id, "total")}
                                                        disabled={client.balance === 0}
                                                    >
                                                        Total
                                                    </Button>
                                                </Group>
                                            </Stack>
                                        </Card>
                                    ))}
                                </Stack>
                            </ScrollArea>
                        </Box>
                    </Stack>
                </Card>

                {/* Bottom Grid */}
                <Grid gutter="md">
                    <Grid.Col span={{ base: 12, md: 6 }}>
                        <Card withBorder radius="lg">
                            <Stack gap="md">
                                <Group gap="xs">
                                    <TrendingUp size={18} />
                                    <Text fw={700}>Principales deudores</Text>
                                </Group>
                                {topDebtors.length === 0 ? (
                                    <Text c="dimmed" ta="center">Todos los clientes están al día.</Text>
                                ) : (
                                    <Stack gap="sm">
                                        {topDebtors.map((client) => (
                                            <Group key={client.id} justify="space-between">
                                                <Group gap="xs">
                                                    <Text>{client.name}</Text>
                                                    <Badge size="xs" variant="light" color={getPaymentScheduleColor(client.payment_schedule)}>
                                                        {getPaymentScheduleLabel(client.payment_schedule)}
                                                    </Badge>
                                                </Group>
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
                                    <Text fw={700}>Últimos movimientos</Text>
                                </Group>
                                {movementTimeline.length === 0 ? (
                                    <Text c="dimmed" ta="center">Aún no registras movimientos de fiado.</Text>
                                ) : (
                                    <ScrollArea h={240}>
                                        <Stack gap="sm">
                                            {movementTimeline.map((movement) => (
                                                <Paper key={movement.id} withBorder radius="md" p="sm">
                                                    <Stack gap={2}>
                                                        <Group justify="space-between">
                                                            <Text fw={600}>{movement.client}</Text>
                                                            <Text size="xs" c="dimmed">{formatDateTime(movement.created_at)}</Text>
                                                        </Group>
                                                        <Text size="sm">{movement.description}</Text>
                                                        <Group justify="space-between">
                                                            <Badge size="xs" variant="light" color={movement.type === "fiado" ? "orange" : "teal"}>
                                                                {movement.type === "fiado" ? "Cargo" : movement.type === "abono" ? "Abono" : "Pago total"}
                                                            </Badge>
                                                            <Text size="xs" c="dimmed">Saldo: {formatCurrency(movement.balance_after)}</Text>
                                                        </Group>
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

            {/* Client Detail Drawer */}
            <Drawer
                opened={drawerOpened}
                onClose={closeDrawer}
                title={
                    <Group gap="xs">
                        <UsersRound size={20} />
                        <Text fw={700}>Detalle del Cliente</Text>
                    </Group>
                }
                position="right"
                size="lg"
                padding="lg"
            >
                {selectedClient && (
                    <Stack gap="lg">
                        {/* Client Info */}
                        <Card withBorder radius="md" style={{ background: "linear-gradient(135deg, rgba(59,130,246,0.08), rgba(147,197,253,0.12))" }}>
                            <Stack gap="md">
                                <Group justify="space-between">
                                    <Text fw={700} size="xl">{selectedClient.name}</Text>
                                    <Badge color={selectedClient.authorized ? "teal" : "red"} variant="filled" size="lg">
                                        {selectedClient.authorized ? "Autorizado" : "Bloqueado"}
                                    </Badge>
                                </Group>
                                <SimpleGrid cols={2}>
                                    <Box>
                                        <Text size="sm" c="dimmed">Límite de crédito</Text>
                                        <Text fw={600}>{formatCurrency(selectedClient.limit)}</Text>
                                    </Box>
                                    <Box>
                                        <Text size="sm" c="dimmed">Saldo pendiente</Text>
                                        <Text fw={700} c={totalPendiente > 0 ? "red" : "teal"}>
                                            {formatCurrency(totalPendiente)}
                                        </Text>
                                    </Box>
                                </SimpleGrid>
                                <Box>
                                    <Text size="sm" c="dimmed" mb="xs">Modalidad de pago</Text>
                                    <Select
                                        data={PAYMENT_SCHEDULE_OPTIONS.map(o => ({ value: o.value, label: `${o.label} - ${o.description}` }))}
                                        value={selectedClient.payment_schedule || "immediate"}
                                        onChange={(value) => {
                                            if (value && onUpdatePaymentSchedule) {
                                                onUpdatePaymentSchedule(selectedClient.id, value as PaymentSchedule);
                                            }
                                        }}
                                        disabled={!onUpdatePaymentSchedule}
                                        size="sm"
                                    />
                                </Box>
                            </Stack>
                        </Card>

                        {/* Date Filter */}
                        <Card withBorder radius="md">
                            <Stack gap="md">
                                <Group gap="xs">
                                    <Calendar size={18} />
                                    <Text fw={600}>Filtrar por período</Text>
                                </Group>
                                <Group gap="xs" wrap="wrap">
                                    <Button size="xs" variant="filled" color="blue" onClick={() => { setDateFrom(null); setDateTo(null); }}>
                                        Todo Pendiente
                                    </Button>
                                    <Button size="xs" variant="light" color="violet" onClick={() => handleQuickDateRange("biweekly")}>
                                        Esta Quincena
                                    </Button>
                                    <Button size="xs" variant="light" color="indigo" onClick={() => handleQuickDateRange("month")}>
                                        Este Mes
                                    </Button>
                                    <Button size="xs" variant="light" color="gray" onClick={() => handleQuickDateRange("lastMonth")}>
                                        Mes Anterior
                                    </Button>
                                </Group>
                                <Grid gutter="sm">
                                    <Grid.Col span={6}>
                                        <TextInput
                                            label="Desde"
                                            type="date"
                                            value={dateFrom ? dayjs(dateFrom).format("YYYY-MM-DD") : ""}
                                            onChange={(e) => setDateFrom(e.currentTarget.value ? new Date(e.currentTarget.value) : null)}
                                            size="sm"
                                        />
                                    </Grid.Col>
                                    <Grid.Col span={6}>
                                        <TextInput
                                            label="Hasta"
                                            type="date"
                                            value={dateTo ? dayjs(dateTo).format("YYYY-MM-DD") : ""}
                                            onChange={(e) => setDateTo(e.currentTarget.value ? new Date(e.currentTarget.value) : null)}
                                            size="sm"
                                        />
                                    </Grid.Col>
                                </Grid>
                            </Stack>
                        </Card>

                        {/* Period Summary */}
                        <SimpleGrid cols={2}>
                            <Paper withBorder radius="md" p="sm" style={{ background: "rgba(254, 226, 226, 0.5)" }}>
                                <Stack gap={2} align="center">
                                    <Text size="xs" c="dimmed">{dateFrom || dateTo ? "Consumos del Período" : "Total Consumos"}</Text>
                                    <Text fw={700} c="red.7">{formatCurrency(periodSummary.totalFiado)}</Text>
                                    <Text size="xs" c="dimmed">{periodSummary.count} compras</Text>
                                </Stack>
                            </Paper>
                            <Paper withBorder radius="md" p="sm" style={{ background: "rgba(219, 234, 254, 0.5)" }}>
                                <Stack gap={2} align="center">
                                    <Text size="xs" c="dimmed">Saldo Pendiente Total</Text>
                                    <Text fw={700} fz="lg" c="indigo.7">{formatCurrency(totalPendiente)}</Text>
                                    <Text size="xs" c="dimmed">{selectedClient?.history?.length ?? 0} compras total</Text>
                                </Stack>
                            </Paper>
                        </SimpleGrid>

                        {/* PDF Export Button */}
                        <Button
                            fullWidth
                            variant="gradient"
                            gradient={{ from: "indigo", to: "violet", deg: 90 }}
                            leftSection={<FileDown size={18} />}
                            onClick={handleGenerateClientPdf}
                        >
                            Generar Informe PDF
                        </Button>

                        {/* Movements List */}
                        <Card withBorder radius="md">
                            <Stack gap="md">
                                <Group justify="space-between">
                                    <Text fw={600}>Historial de movimientos</Text>
                                    <Badge variant="light">{filteredMovements.length} registros</Badge>
                                </Group>
                                {filteredMovements.length === 0 ? (
                                    <Text c="dimmed" ta="center" py="lg">No hay movimientos en el período seleccionado.</Text>
                                ) : (
                                    <ScrollArea h={300}>
                                        <Stack gap="sm">
                                            {filteredMovements.map((movement) => (
                                                <Paper key={movement.id} withBorder radius="md" p="sm">
                                                    <Group justify="space-between" mb="xs">
                                                        <Badge
                                                            color={movement.type === "fiado" ? "orange" : "teal"}
                                                            variant="filled"
                                                            size="sm"
                                                        >
                                                            {movement.type === "fiado" ? "Cargo" : movement.type === "abono" ? "Abono" : "Pago total"}
                                                        </Badge>
                                                        <Text size="xs" c="dimmed">{formatDateTime(movement.created_at)}</Text>
                                                    </Group>
                                                    <Group justify="space-between">
                                                        <Text size="sm">{movement.description || "Sin descripción"}</Text>
                                                        <Text fw={600} c={movement.type === "fiado" ? "red" : "teal"}>
                                                            {movement.type === "fiado" ? "+" : "-"}{formatCurrency(movement.amount)}
                                                        </Text>
                                                    </Group>
                                                    <Text size="xs" c="dimmed" mt="xs">Saldo: {formatCurrency(movement.balance_after)}</Text>
                                                </Paper>
                                            ))}
                                        </Stack>
                                    </ScrollArea>
                                )}
                            </Stack>
                        </Card>

                        {/* Quick Actions */}
                        <Group grow>
                            <Button
                                variant="light"
                                leftSection={<Coins size={16} />}
                                onClick={() => { closeDrawer(); onOpenModal(selectedClient.id, "abono"); }}
                                disabled={selectedClient.balance === 0}
                            >
                                Registrar Abono
                            </Button>
                            <Button
                                variant="light"
                                color="teal"
                                leftSection={<PiggyBank size={16} />}
                                onClick={() => { closeDrawer(); onOpenModal(selectedClient.id, "total"); }}
                                disabled={selectedClient.balance === 0}
                            >
                                Pago Total
                            </Button>
                        </Group>
                    </Stack>
                )}
            </Drawer>
        </>
    );
};

export default FiadosViewEnhanced;
