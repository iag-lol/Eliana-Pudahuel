import {
  ActionIcon,
  Badge,
  Button,
  Divider,
  Group,
  Modal,
  NumberInput,
  Paper,
  ScrollArea,
  Stack,
  Table,
  Text,
  TextInput
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useMemo, useState } from "react";
import { Plus, Search, Trash2, X } from "lucide-react";
import { Product } from "../types";

interface StockRequestDraft {
  productId: string;
  productName: string;
  quantity: number;
}

interface QuickStockModalProps {
  opened: boolean;
  onClose: () => void;
  products: Product[];
  onSubmitRequests: (requests: StockRequestDraft[]) => Promise<void> | void;
}

export function QuickStockModal({
  opened,
  onClose,
  products,
  onSubmitRequests
}: QuickStockModalProps) {
  const [search, setSearch] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState<number | "">("");
  const [requestItems, setRequestItems] = useState<StockRequestDraft[]>([]);
  const [loading, setLoading] = useState(false);

  const filteredProducts = useMemo(() => {
    if (!search.trim()) return [];
    const lowerSearch = search.toLowerCase();
    return products
      .filter(
        (p) =>
          p.name.toLowerCase().includes(lowerSearch) ||
          p.barcode?.toLowerCase().includes(lowerSearch) ||
          p.category?.toLowerCase().includes(lowerSearch)
      )
      .slice(0, 6);
  }, [search, products]);

  const handleClose = () => {
    setSearch("");
    setSelectedProduct(null);
    setQuantity("");
    setRequestItems([]);
    onClose();
  };

  const handleAddRequestItem = () => {
    if (!selectedProduct) return;
    if (typeof quantity !== "number" || quantity <= 0) {
      notifications.show({
        title: "Cantidad inválida",
        message: "Ingresa una cantidad mayor a 0",
        color: "red"
      });
      return;
    }

    setRequestItems((prev) => {
      const existing = prev.find((item) => item.productId === selectedProduct.id);
      if (existing) {
        return prev.map((item) =>
          item.productId === selectedProduct.id
            ? { ...item, quantity: item.quantity + quantity }
            : item
        );
      }
      return [
        ...prev,
        {
          productId: selectedProduct.id,
          productName: selectedProduct.name,
          quantity
        }
      ];
    });

    setSelectedProduct(null);
    setQuantity("");
    setSearch("");
  };

  const handleUpdateItemQuantity = (productId: string, value: number | "") => {
    if (value === "" || value === null) return;
    const parsed = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(parsed)) return;

    setRequestItems((prev) =>
      prev.map((item) =>
        item.productId === productId
          ? { ...item, quantity: Math.max(1, Math.round(parsed)) }
          : item
      )
    );
  };

  const handleRemoveItem = (productId: string) => {
    setRequestItems((prev) => prev.filter((item) => item.productId !== productId));
  };

  const handleSubmitRequests = async () => {
    if (requestItems.length === 0) {
      notifications.show({
        title: "Sin productos",
        message: "Agrega al menos un producto a la solicitud",
        color: "orange"
      });
      return;
    }

    setLoading(true);
    try {
      await Promise.resolve(onSubmitRequests(requestItems));
      handleClose();
    } catch (error) {
      console.error("Error enviando solicitud de stock:", error);
      notifications.show({
        title: "Error",
        message: "No se pudo enviar la solicitud. Inténtalo de nuevo.",
        color: "red"
      });
    } finally {
      setLoading(false);
    }
  };

  const totalUnits = requestItems.reduce((acc, item) => acc + item.quantity, 0);

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      title="Solicitud de stock rápido"
      size="lg"
      radius="md"
      centered
    >
      <Stack gap="md">
        <Text size="sm" c="dimmed">
          La cajera solicita aumento de stock. Las solicitudes aparecerán en Inventario para autorización.
        </Text>

        {!selectedProduct && (
          <Stack gap="xs">
            <Text fw={500} size="sm">
              Buscar producto
            </Text>
            <TextInput
              placeholder="Nombre, categoría o código de barras..."
              leftSection={<Search size={16} />}
              value={search}
              onChange={(event) => setSearch(event.currentTarget.value)}
              autoFocus
            />

            {filteredProducts.length > 0 && (
              <Paper withBorder radius="md" mt="xs">
                <Stack gap={0}>
                  {filteredProducts.map((product, index) => (
                    <div key={product.id}>
                      <Group
                        p="sm"
                        justify="space-between"
                        style={{ cursor: "pointer" }}
                        onClick={() => setSelectedProduct(product)}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#f8f9fa")}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                      >
                        <Stack gap={2}>
                          <Text fw={600} size="sm">
                            {product.name}
                          </Text>
                          <Text size="xs" c="dimmed">
                            {product.category} • SKU: {product.barcode || "S/C"}
                          </Text>
                        </Stack>
                        <Badge
                          color={product.stock <= (product.minStock || 5) ? "red" : "teal"}
                          variant="filled"
                        >
                          STOCK: {product.stock}
                        </Badge>
                      </Group>
                      {index < filteredProducts.length - 1 && <Divider />}
                    </div>
                  ))}
                </Stack>
              </Paper>
            )}

            {search && filteredProducts.length === 0 && (
              <Text size="sm" c="dimmed" ta="center" mt="sm">
                No se encontraron productos
              </Text>
            )}
          </Stack>
        )}

        {selectedProduct && (
          <Paper withBorder radius="md" p="md" style={{ borderColor: "#228be6" }}>
            <Stack gap="md">
              <Group justify="space-between" align="flex-start">
                <Stack gap={0}>
                  <Text fw={700} size="lg">
                    {selectedProduct.name}
                  </Text>
                  <Text size="sm" c="dimmed">
                    {selectedProduct.category}
                  </Text>
                </Stack>
                <ActionIcon variant="subtle" color="gray" onClick={() => setSelectedProduct(null)}>
                  <X size={20} />
                </ActionIcon>
              </Group>

              <Divider />

              <Group justify="space-between">
                <Text size="sm">Stock actual:</Text>
                <Badge size="lg" color="red" variant="filled">
                  {selectedProduct.stock} UNIDADES
                </Badge>
              </Group>

              <Stack gap={4}>
                <Text size="sm" fw={500}>
                  Cantidad solicitada
                </Text>
                <NumberInput
                  value={quantity}
                  onChange={(val) => setQuantity(typeof val === "number" ? val : "")}
                  placeholder="0"
                  min={1}
                />
              </Stack>

              <Group justify="flex-end">
                <Button variant="light" onClick={() => setSelectedProduct(null)}>
                  Cancelar
                </Button>
                <Button color="teal" leftSection={<Plus size={16} />} onClick={handleAddRequestItem}>
                  Agregar a solicitud
                </Button>
              </Group>
            </Stack>
          </Paper>
        )}

        {requestItems.length > 0 && (
          <Paper withBorder radius="md" p="md">
            <Stack gap="sm">
              <Group justify="space-between">
                <Text fw={600}>Productos solicitados</Text>
                <Badge color="indigo" variant="light">
                  {requestItems.length} items • {totalUnits} unidades
                </Badge>
              </Group>
              <ScrollArea h={220}>
                <Table highlightOnHover>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Producto</Table.Th>
                      <Table.Th style={{ width: 140 }}>Cantidad</Table.Th>
                      <Table.Th style={{ width: 80 }}>Acción</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {requestItems.map((item) => (
                      <Table.Tr key={item.productId}>
                        <Table.Td>
                          <Text fw={600}>{item.productName}</Text>
                        </Table.Td>
                        <Table.Td>
                          <NumberInput
                            value={item.quantity}
                            min={1}
                            onChange={(value) => handleUpdateItemQuantity(item.productId, value)}
                          />
                        </Table.Td>
                        <Table.Td>
                          <ActionIcon color="red" variant="light" onClick={() => handleRemoveItem(item.productId)}>
                            <Trash2 size={16} />
                          </ActionIcon>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </ScrollArea>
            </Stack>
          </Paper>
        )}

        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={handleClose}>
            Cancelar
          </Button>
          <Button
            color="teal"
            leftSection={<Plus size={16} />}
            onClick={handleSubmitRequests}
            loading={loading}
            disabled={requestItems.length === 0}
          >
            Enviar solicitud
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
