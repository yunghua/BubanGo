"use client";

import { BubanGoProvider } from "@/hooks/useBubanGoData";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return <BubanGoProvider>{children}</BubanGoProvider>;
}
