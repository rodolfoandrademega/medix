"use client";

import LoadingScreen from "./components/LoadingScreen";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <LoadingScreen error="Não foi possível abrir esta página. Tente novamente em alguns instantes." retry={reset} />;
}
