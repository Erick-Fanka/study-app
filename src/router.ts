// Rotas com hash (#/cursos): o servidor só precisa entregar o index.html,
// sem regra de reescrita para cada rota.

import { useEffect, useState } from "react";
import type { IconName } from "./components/Icon";

export type Accent = "orange" | "blue" | "green" | "ink";

export interface RouteDef {
  path: string;
  label: string;
  icon: IconName;
  accent: Accent;
  step?: string;
  description?: string;
}

export const ROUTES: RouteDef[] = [
  { path: "/", label: "Início", icon: "home", accent: "orange" },
  {
    path: "/cursos",
    label: "Cursos",
    icon: "book",
    accent: "orange",
    step: "Etapas 3 e 4",
    description: "Áreas, cursos e módulos com progresso, materiais e labs.",
  },
  {
    path: "/certificacoes",
    label: "Certificações",
    icon: "award",
    accent: "green",
    step: "Etapa 5",
    description: "Status, prova, credencial, validade e simulados por domínio.",
  },
  {
    path: "/agenda",
    label: "Agenda",
    icon: "calendar",
    accent: "blue",
    step: "Etapas 8 e 9",
    description: "Blocos de estudo, prazos e histórico em dia, semana, mês e lista.",
  },
  {
    path: "/tempo",
    label: "Tempo",
    icon: "clock",
    accent: "ink",
    step: "Etapa 7",
    description: "Cronômetro, pomodoro e registro manual das horas estudadas.",
  },
];

function currentPath(): string {
  const h = window.location.hash.replace(/^#/, "");
  return h.startsWith("/") ? h : "/";
}

export function useRoute(): string {
  const [path, setPath] = useState(currentPath);
  useEffect(() => {
    const onChange = () => {
      setPath(currentPath());
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return path;
}

export function href(path: string): string {
  return `#${path}`;
}
