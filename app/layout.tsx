
import type { Metadata } from "next";
import type { ReactNode } from "react";
import PersistentAppShell from "./PersistentAppShell";
import "./globals.css";

export const metadata: Metadata = {
  title: "Belot | Igraj s ekipom",
  description: "Online Belot za društvo i prijatelje.",
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="hr">
      <body>
        <PersistentAppShell>{children}</PersistentAppShell>
      </body>
    </html>
  );
}
