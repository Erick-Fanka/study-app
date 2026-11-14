// Cronômetro ativo: um único item sk = CRONO. Fica salvo no navegador, então
// continua rodando mesmo se a aba for fechada. O tempo corre a partir de
// "rodandoDesde" (epoch ms do último início/retomada).

import type { Store, Item } from "./store";
import { ALVO_LIVRE, type Alvo } from "./sessoes";
import { nowIso } from "./validate";

export type ModoCrono = "livre" | "pomodoro";

export interface Crono {
  alvo: Alvo;
  modo: ModoCrono;
  focoMin: number;
  pausaMin: number;
  inicio: string; // AAAA-MM-DDTHH:MM do primeiro início
  acumuladoMs: number; // tempo já corrido antes da última pausa
  rodandoDesde: number | null; // epoch ms; null = pausado
}

const SK = "CRONO";

export function elapsedMs(c: Crono, now = Date.now()): number {
  return c.acumuladoMs + (c.rodandoDesde ? Math.max(0, now - c.rodandoDesde) : 0);
}

export interface Fase {
  foco: boolean;
  ciclo: number; // 1, 2, 3…
  restanteMs: number;
}

export function fasePomodoro(c: Crono, now = Date.now()): Fase {
  const focoMs = c.focoMin * 60_000;
  const cicloMs = focoMs + c.pausaMin * 60_000;
  const e = elapsedMs(c, now);
  const dentro = e % cicloMs;
  const foco = dentro < focoMs;
  return { foco, ciclo: Math.floor(e / cicloMs) + 1, restanteMs: foco ? focoMs - dentro : cicloMs - dentro };
}

/** Minutos que contam como estudo: no pomodoro, só o tempo de foco. */
export function minutosEstudados(c: Crono, now = Date.now()): number {
  const e = elapsedMs(c, now);
  if (c.modo === "livre") return Math.round(e / 60_000);
  const focoMs = c.focoMin * 60_000;
  const cicloMs = focoMs + c.pausaMin * 60_000;
  const foco = Math.floor(e / cicloMs) * focoMs + Math.min(e % cicloMs, focoMs);
  return Math.round(foco / 60_000);
}

export function fmtRelogio(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const p = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${p(m)}:${p(s)}` : `${p(m)}:${p(s)}`;
}

function fromItem(item: Item | null): Crono | null {
  if (!item || item.sk !== SK) return null;
  const a = (item.alvo ?? {}) as Record<string, unknown>;
  const num = (v: unknown, d: number) => (typeof v === "number" && Number.isFinite(v) ? v : d);
  return {
    alvo: {
      tipo: a.tipo === "curso" || a.tipo === "cert" ? a.tipo : "livre",
      id: typeof a.id === "string" ? a.id : "",
      nome: typeof a.nome === "string" ? a.nome : ALVO_LIVRE.nome,
      areaId: typeof a.areaId === "string" ? a.areaId : "",
    },
    modo: item.modo === "pomodoro" ? "pomodoro" : "livre",
    focoMin: Math.min(120, Math.max(5, num(item.focoMin, 25))),
    pausaMin: Math.min(60, Math.max(1, num(item.pausaMin, 5))),
    inicio: typeof item.inicio === "string" ? item.inicio : "",
    acumuladoMs: Math.max(0, num(item.acumuladoMs, 0)),
    rodandoDesde: typeof item.rodandoDesde === "number" ? item.rodandoDesde : null,
  };
}

export async function loadCrono(db: Store): Promise<Crono | null> {
  return fromItem(await db.getItem(SK));
}

export async function saveCrono(db: Store, c: Crono): Promise<void> {
  await db.putItem({
    sk: SK,
    tipo: "CRONO",
    alvo: { ...c.alvo },
    modo: c.modo,
    focoMin: c.focoMin,
    pausaMin: c.pausaMin,
    inicio: c.inicio,
    acumuladoMs: c.acumuladoMs,
    rodandoDesde: c.rodandoDesde,
    atualizadoEm: nowIso(),
  });
}

export async function clearCrono(db: Store): Promise<void> {
  await db.deleteItem(SK);
}
