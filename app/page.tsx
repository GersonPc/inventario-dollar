import type { Metadata } from "next";
import { InventoryApp } from "./InventoryApp";

export const metadata: Metadata = {
  title: { absolute: "Inventario | Bodega Dollar" },
  description: "Control interno de equipos y entregas a tiendas Dollar.",
};

export default function Home() {
  return <InventoryApp />;
}
