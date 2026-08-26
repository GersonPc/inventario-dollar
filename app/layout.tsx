import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host =
    requestHeaders.get("x-forwarded-host")?.split(",")[0].trim() ||
    requestHeaders.get("host") ||
    "localhost";
  const forwardedProtocol = requestHeaders
    .get("x-forwarded-proto")
    ?.split(",")[0]
    .trim();
  const protocol = forwardedProtocol || (host.startsWith("localhost") ? "http" : "https");
  const metadataBase = new URL(`${protocol}://${host}`);
  const socialImage = new URL("/og.png", metadataBase).toString();

  return {
    metadataBase,
    title: {
      default: "Inventario Dollar",
      template: "%s | Inventario Dollar",
    },
    description:
      "Control interno de equipos, existencias y entregas a tiendas Dollar.",
    icons: {
      icon: "/favicon.svg",
      shortcut: "/favicon.svg",
    },
    openGraph: {
      title: "Inventario Dollar",
      description: "Bodega de equipos y entregas a tiendas.",
      type: "website",
      images: [{ url: socialImage, width: 1736, height: 909, alt: "Inventario Dollar — Bodega de equipos" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "Inventario Dollar",
      description: "Bodega de equipos y entregas a tiendas.",
      images: [socialImage],
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
