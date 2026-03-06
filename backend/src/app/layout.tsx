import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Navigate Easy Backend",
  description: "API backend for route optimization and address autocomplete.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
