"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { supabase } from "../../lib/supabase";

export default function ConnectedAccount() {
  const previousId = useRef<string | null | undefined>(undefined);
  const pathname = usePathname();
  const route = useRef(pathname);
  route.current = pathname;

  useEffect(() => {
    const subscription = supabase?.auth.onAuthStateChange((_event, session) => {
      const next = session?.user || null;
      const changed = previousId.current !== undefined && previousId.current !== (next?.id || null);
      previousId.current = next?.id || null;
      // Quando outra aba troca a conta, descarte os dados da sessão anterior.
      if (changed && ["/dashboard", "/onboarding", "/pending-approval", "/admin"].includes(route.current)) {
        window.location.replace(next ? (route.current === "/admin" ? "/admin" : "/onboarding") : "/auth");
      }
    }).data.subscription;
    return () => subscription?.unsubscribe();
  }, []);

  return null;
}
