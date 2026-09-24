import type { Metadata } from "next";
import "./globals.css";
import "./mobile.css";

export const metadata: Metadata = {
  title: "Medix | Gestão inteligente para clínicas",
  description: "A plataforma que organiza o cuidado da sua clínica.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body suppressHydrationWarning>{children}</body></html>;
}
