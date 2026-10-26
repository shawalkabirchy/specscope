import type { Metadata } from "next";
import "@fontsource-variable/geist";
import "./globals.css";

export const metadata: Metadata = {
  title: "SpecScope — A clearer scope. A better conversation.",
  description:
    "Compare client requests with agreed scope, document your decisions, and create clear change orders. A local-first portfolio project by ConsoleLog Studio.",
  icons: { icon: "/icon.svg" },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
