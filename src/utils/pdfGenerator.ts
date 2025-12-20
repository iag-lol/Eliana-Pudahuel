import { jsPDF } from "jspdf";
import "jspdf-autotable";
import type { Client, ClientMovement, PaymentSchedule } from "../types";

// Extend jsPDF with autotable
declare module "jspdf" {
    interface jsPDF {
        autoTable: (options: AutoTableOptions) => jsPDF;
        lastAutoTable: { finalY: number };
    }
}

interface AutoTableOptions {
    head?: string[][];
    body?: (string | number)[][];
    startY?: number;
    theme?: "striped" | "grid" | "plain";
    headStyles?: Record<string, unknown>;
    bodyStyles?: Record<string, unknown>;
    columnStyles?: Record<number, Record<string, unknown>>;
    margin?: { left?: number; right?: number };
    tableWidth?: "auto" | "wrap" | number;
    styles?: Record<string, unknown>;
    alternateRowStyles?: Record<string, unknown>;
}

// Utility functions
const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat("es-CL", {
        style: "currency",
        currency: "CLP",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(value);
};

const formatDate = (date: string): string => {
    return new Date(date).toLocaleDateString("es-CL", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric"
    });
};

const formatDateTime = (date: string): string => {
    return new Date(date).toLocaleString("es-CL", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
    });
};

const getPaymentScheduleLabel = (schedule?: PaymentSchedule): string => {
    switch (schedule) {
        case "biweekly":
            return "Quincenal";
        case "monthly":
            return "Fin de Mes";
        case "immediate":
        default:
            return "Inmediato";
    }
};

const getMovementTypeLabel = (type: string): string => {
    switch (type) {
        case "fiado":
            return "Compra a crédito";
        case "abono":
            return "Abono";
        case "pago-total":
            return "Pago total";
        default:
            return type;
    }
};

interface ClientReportOptions {
    client: Client;
    movements: ClientMovement[];
    dateFrom?: Date | null;
    dateTo?: Date | null;
    storeName?: string;
}

/**
 * Generate a detailed PDF report for a single client
 */
export const generateClientReport = ({
    client,
    movements,
    dateFrom,
    dateTo,
    storeName = "Minimarket Eliana Pudahuel"
}: ClientReportOptions): void => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    // Header
    doc.setFillColor(59, 130, 246);
    doc.rect(0, 0, pageWidth, 35, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.setFont("helvetica", "bold");
    doc.text(storeName, 14, 18);

    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.text("Reporte de Consumos - Cliente Fiado", 14, 28);

    // Report date
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.text(`Generado: ${formatDateTime(new Date().toISOString())}`, pageWidth - 70, 18);

    // Period info
    if (dateFrom || dateTo) {
        const fromStr = dateFrom ? formatDate(dateFrom.toISOString()) : "Inicio";
        const toStr = dateTo ? formatDate(dateTo.toISOString()) : "Hoy";
        doc.text(`Período: ${fromStr} - ${toStr}`, pageWidth - 70, 28);
    }

    // Client info section
    let yPos = 50;

    doc.setTextColor(0, 0, 0);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Información del Cliente", 14, yPos);

    yPos += 10;
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");

    // Client details box
    doc.setDrawColor(200, 200, 200);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(14, yPos - 5, pageWidth - 28, 40, 3, 3, "FD");

    doc.text(`Nombre: ${client.name}`, 20, yPos + 5);
    doc.text(`Límite de crédito: ${formatCurrency(client.limit)}`, 20, yPos + 15);
    doc.text(`Saldo actual: ${formatCurrency(client.balance)}`, 20, yPos + 25);
    doc.text(`Modalidad de pago: ${getPaymentScheduleLabel(client.payment_schedule)}`, pageWidth / 2, yPos + 5);
    doc.text(`Estado: ${client.authorized ? "Autorizado" : "Bloqueado"}`, pageWidth / 2, yPos + 15);

    yPos += 50;

    // Summary section
    const totalFiado = movements.reduce((sum, m) => sum + m.amount, 0);

    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Resumen", 14, yPos);

    yPos += 10;

    // Summary boxes - 2 columns
    const boxWidth = (pageWidth - 35) / 2;

    // Consumos box
    doc.setFillColor(254, 226, 226);
    doc.roundedRect(14, yPos - 5, boxWidth, 25, 3, 3, "F");
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(127, 29, 29);
    doc.text("Total Consumos (Período)", 14 + boxWidth / 2, yPos + 3, { align: "center" });
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text(formatCurrency(totalFiado), 14 + boxWidth / 2, yPos + 14, { align: "center" });

    // Saldo Pendiente box
    doc.setFillColor(219, 234, 254);
    doc.roundedRect(14 + boxWidth + 7, yPos - 5, boxWidth, 25, 3, 3, "F");
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(30, 64, 175);
    doc.text("Saldo Pendiente Total", 14 + boxWidth + 7 + boxWidth / 2, yPos + 3, { align: "center" });
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text(formatCurrency(client.balance), 14 + boxWidth + 7 + boxWidth / 2, yPos + 14, { align: "center" });

    yPos += 35;

    // Movements table
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Detalle de Movimientos", 14, yPos);

    yPos += 5;

    if (movements.length === 0) {
        doc.setFontSize(11);
        doc.setFont("helvetica", "normal");
        doc.text("No hay movimientos en el período seleccionado.", 14, yPos + 10);
    } else {
        const tableData = movements.map(m => [
            formatDateTime(m.created_at),
            m.description || "Compra a crédito",
            formatCurrency(m.amount)
        ]);

        doc.autoTable({
            head: [["Fecha y Hora", "Descripción", "Monto"]],
            body: tableData,
            startY: yPos,
            theme: "striped",
            headStyles: {
                fillColor: [59, 130, 246],
                textColor: 255,
                fontStyle: "bold",
                fontSize: 10
            },
            bodyStyles: {
                fontSize: 9
            },
            columnStyles: {
                0: { cellWidth: 45 },
                1: { cellWidth: "auto" },
                2: { cellWidth: 35, halign: "right" }
            },
            margin: { left: 14, right: 14 },
            alternateRowStyles: {
                fillColor: [248, 250, 252]
            }
        });
    }

    // Footer
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(128, 128, 128);
        doc.text(
            `Página ${i} de ${pageCount} - ${storeName}`,
            pageWidth / 2,
            doc.internal.pageSize.getHeight() - 10,
            { align: "center" }
        );
    }

    // Download the PDF
    const fileName = `reporte_${client.name.replace(/\s+/g, "_").toLowerCase()}_${formatDate(new Date().toISOString()).replace(/\//g, "-")}.pdf`;
    doc.save(fileName);
};

interface SummaryReportOptions {
    clients: Client[];
    dateFrom?: Date | null;
    dateTo?: Date | null;
    storeName?: string;
}

/**
 * Generate a summary PDF report for all clients
 */
export const generateSummaryReport = ({
    clients,
    dateFrom,
    dateTo,
    storeName = "Minimarket Eliana Pudahuel"
}: SummaryReportOptions): void => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    // Header
    doc.setFillColor(59, 130, 246);
    doc.rect(0, 0, pageWidth, 35, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.setFont("helvetica", "bold");
    doc.text(storeName, 14, 18);

    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.text("Resumen General de Clientes Fiados", 14, 28);

    // Report date
    doc.setFontSize(10);
    doc.text(`Generado: ${formatDateTime(new Date().toISOString())}`, pageWidth - 70, 18);

    if (dateFrom || dateTo) {
        const fromStr = dateFrom ? formatDate(dateFrom.toISOString()) : "Inicio";
        const toStr = dateTo ? formatDate(dateTo.toISOString()) : "Hoy";
        doc.text(`Período: ${fromStr} - ${toStr}`, pageWidth - 70, 28);
    }

    // Summary stats
    let yPos = 50;

    const totalDebt = clients.reduce((sum, c) => sum + c.balance, 0);
    const authorizedCount = clients.filter(c => c.authorized).length;
    const blockedCount = clients.filter(c => !c.authorized).length;
    const clientsWithDebt = clients.filter(c => c.balance > 0);

    doc.setTextColor(0, 0, 0);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Resumen General", 14, yPos);

    yPos += 10;

    const boxWidth = (pageWidth - 49) / 4;

    // Total clients
    doc.setFillColor(219, 234, 254);
    doc.roundedRect(14, yPos - 5, boxWidth, 25, 3, 3, "F");
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(30, 64, 175);
    doc.text("Total Clientes", 14 + boxWidth / 2, yPos + 3, { align: "center" });
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text(String(clients.length), 14 + boxWidth / 2, yPos + 14, { align: "center" });

    // Authorized
    doc.setFillColor(220, 252, 231);
    doc.roundedRect(14 + boxWidth + 7, yPos - 5, boxWidth, 25, 3, 3, "F");
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(22, 101, 52);
    doc.text("Autorizados", 14 + boxWidth + 7 + boxWidth / 2, yPos + 3, { align: "center" });
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text(String(authorizedCount), 14 + boxWidth + 7 + boxWidth / 2, yPos + 14, { align: "center" });

    // Blocked
    doc.setFillColor(254, 226, 226);
    doc.roundedRect(14 + (boxWidth + 7) * 2, yPos - 5, boxWidth, 25, 3, 3, "F");
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(127, 29, 29);
    doc.text("Bloqueados", 14 + (boxWidth + 7) * 2 + boxWidth / 2, yPos + 3, { align: "center" });
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text(String(blockedCount), 14 + (boxWidth + 7) * 2 + boxWidth / 2, yPos + 14, { align: "center" });

    // Total debt
    doc.setFillColor(254, 243, 199);
    doc.roundedRect(14 + (boxWidth + 7) * 3, yPos - 5, boxWidth, 25, 3, 3, "F");
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(146, 64, 14);
    doc.text("Deuda Total", 14 + (boxWidth + 7) * 3 + boxWidth / 2, yPos + 3, { align: "center" });
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text(formatCurrency(totalDebt), 14 + (boxWidth + 7) * 3 + boxWidth / 2, yPos + 14, { align: "center" });

    yPos += 40;

    // Clients with debt table
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Clientes con Saldo Pendiente", 14, yPos);

    yPos += 5;

    if (clientsWithDebt.length === 0) {
        doc.setFontSize(11);
        doc.setFont("helvetica", "normal");
        doc.text("No hay clientes con saldo pendiente.", 14, yPos + 10);
    } else {
        // Sort by balance descending
        const sortedClients = [...clientsWithDebt].sort((a, b) => b.balance - a.balance);

        const tableData = sortedClients.map(c => [
            c.name,
            c.authorized ? "Autorizado" : "Bloqueado",
            getPaymentScheduleLabel(c.payment_schedule),
            formatCurrency(c.limit),
            formatCurrency(c.balance)
        ]);

        doc.autoTable({
            head: [["Cliente", "Estado", "Modalidad Pago", "Límite", "Saldo Pendiente"]],
            body: tableData,
            startY: yPos,
            theme: "striped",
            headStyles: {
                fillColor: [59, 130, 246],
                textColor: 255,
                fontStyle: "bold",
                fontSize: 10
            },
            bodyStyles: {
                fontSize: 9
            },
            columnStyles: {
                0: { cellWidth: "auto" },
                1: { cellWidth: 30 },
                2: { cellWidth: 35 },
                3: { cellWidth: 30, halign: "right" },
                4: { cellWidth: 35, halign: "right" }
            },
            margin: { left: 14, right: 14 },
            alternateRowStyles: {
                fillColor: [248, 250, 252]
            }
        });

        yPos = doc.lastAutoTable.finalY + 15;
    }

    // All clients table
    if (yPos + 60 > doc.internal.pageSize.getHeight()) {
        doc.addPage();
        yPos = 20;
    }

    doc.setTextColor(0, 0, 0);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Listado Completo de Clientes", 14, yPos);

    yPos += 5;

    const allClientsData = clients.map(c => [
        c.name,
        c.authorized ? "Autorizado" : "Bloqueado",
        getPaymentScheduleLabel(c.payment_schedule),
        formatCurrency(c.limit),
        formatCurrency(c.balance)
    ]);

    doc.autoTable({
        head: [["Cliente", "Estado", "Modalidad Pago", "Límite", "Saldo"]],
        body: allClientsData,
        startY: yPos,
        theme: "striped",
        headStyles: {
            fillColor: [100, 116, 139],
            textColor: 255,
            fontStyle: "bold",
            fontSize: 10
        },
        bodyStyles: {
            fontSize: 9
        },
        columnStyles: {
            0: { cellWidth: "auto" },
            1: { cellWidth: 30 },
            2: { cellWidth: 35 },
            3: { cellWidth: 30, halign: "right" },
            4: { cellWidth: 35, halign: "right" }
        },
        margin: { left: 14, right: 14 },
        alternateRowStyles: {
            fillColor: [248, 250, 252]
        }
    });

    // Footer
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(128, 128, 128);
        doc.text(
            `Página ${i} de ${pageCount} - ${storeName}`,
            pageWidth / 2,
            doc.internal.pageSize.getHeight() - 10,
            { align: "center" }
        );
    }

    // Download the PDF
    const fileName = `resumen_fiados_${formatDate(new Date().toISOString()).replace(/\//g, "-")}.pdf`;
    doc.save(fileName);
};
