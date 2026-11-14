"use client";

import type { ReactNode } from "react";
import { Suspense } from "react";
import Home from "./page";
import { AppShellContext } from "./AppShellContext";

export default function PersistentAppShell({ children }: { children: ReactNode }) {
  return (
    <>
      <Suspense fallback={<div className="route-loading">Belot se učitava...</div>}>
        <AppShellContext.Provider value={true}>
          <Home />
        </AppShellContext.Provider>
      </Suspense>
      <AppShellContext.Provider value={false}>
        {children}
      </AppShellContext.Provider>
    </>
  );
}
