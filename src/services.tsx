import { createContext, useContext, type ReactNode } from "react";
import type { Store } from "./data/store";

export interface Services {
  db: Store;
}

const ServicesContext = createContext<Services | null>(null);

export function ServicesProvider({ value, children }: { value: Services; children: ReactNode }) {
  return <ServicesContext.Provider value={value}>{children}</ServicesContext.Provider>;
}

export function useServices(): Services {
  const s = useContext(ServicesContext);
  if (!s) throw new Error("ServicesProvider ausente");
  return s;
}
