import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Singers Universe — Admin",
  description: "Admin panel pro správu Singers Universe platformy",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="cs">
      <body>{children}</body>
    </html>
  );
}
