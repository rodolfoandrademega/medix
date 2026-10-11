import type { Metadata } from "next";
import "./globals.css";
import "./mobile.css";
import ConnectedAccount from "./components/ConnectedAccount";

export const metadata: Metadata = {
  title: "Medix | Gestão inteligente para clínicas",
  description: "A plataforma que organiza o cuidado da sua clínica.",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon", apple: "/apple-icon" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body suppressHydrationWarning><ConnectedAccount />{children}</body></html>;
}
