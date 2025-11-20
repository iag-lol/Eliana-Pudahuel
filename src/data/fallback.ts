import { Client, Product, Sale, Shift } from "../types";

export const FALLBACK_PRODUCTS: Product[] = [
  { id: "p1", name: "Aceite Girasol 1L", barcode: "7801234000016", category: "Despensa", price: 3490, stock: 18, minStock: 5 },
  { id: "p2", name: "Harina Tradicional 1Kg", barcode: "7801234000023", category: "Despensa", price: 1590, stock: 26, minStock: 5 },
  { id: "p3", name: "Azúcar Flor 1Kg", barcode: "7801234000030", category: "Despensa", price: 1990, stock: 12, minStock: 5 },
  { id: "p4", name: "Leche Entera 1L", barcode: "7801234000047", category: "Lácteos", price: 1190, stock: 42, minStock: 8 },
  { id: "p5", name: "Queso Gouda 200g", barcode: "7801234000054", category: "Lácteos", price: 2480, stock: 9, minStock: 4 },
  { id: "p6", name: "Pan Amasado 1Kg", barcode: "7801234000061", category: "Panadería", price: 2290, stock: 6, minStock: 5 },
  { id: "p7", name: "Café Instantáneo 170g", barcode: "7801234000078", category: "Bebestibles", price: 4790, stock: 15, minStock: 4 },
  { id: "p8", name: "Bebida Cola 2.5L", barcode: "7801234000085", category: "Bebestibles", price: 2290, stock: 24, minStock: 6 },
  { id: "p9", name: "Papas Fritas Familiar", barcode: "7801234000092", category: "Snacks", price: 1990, stock: 5, minStock: 5 },
  { id: "p10", name: "Detergente Líquido 3L", barcode: "7801234000108", category: "Limpieza", price: 6990, stock: 11, minStock: 3 },
  { id: "p11", name: "Jabón Líquido Manos 400ml", barcode: "7801234000115", category: "Higiene", price: 1690, stock: 7, minStock: 4 },
  { id: "p12", name: "Toallitas Húmedas 80u", barcode: "7801234000122", category: "Higiene", price: 2690, stock: 10, minStock: 4 }
];

export const FALLBACK_CLIENTS: Client[] = [
  { id: "c1", name: "Juan Pérez", authorized: true, balance: 18500, limit: 60000 },
  { id: "c2", name: "María González", authorized: true, balance: 9600, limit: 45000 },
  { id: "c3", name: "Ferretería López", authorized: true, balance: 0, limit: 200000 },
  { id: "c4", name: "Pedro Muñoz", authorized: false, balance: 0, limit: 0 }
];

export const FALLBACK_SALES: Sale[] = [];
export const FALLBACK_SHIFTS: Shift[] = [];
