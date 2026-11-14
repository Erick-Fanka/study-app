// Simulados de uma certificação. Item: sk = SIM#<certId>#<data>#<id>, assim a
// leitura pelo prefixo "SIM#<certId>#" já volta em ordem de data.

import type { Store, Item } from "./store";
import type { Dominio } from "./certs";
import { checkText, newId, nowIso } from "./validate";
import { isDate } from "./dates";

export type ModoNota = "pct" | "acertos";

export interface NotaDominio {
  dominioId: string;
  pct: number | null; // modo "pct"
  acertos: number | null; // modo "acertos"
  total: number | null;
}

export interface Simulado {
  id: string;
  certId: string;
  data: string;
  fonte: string;
  modo: ModoNota;
  geral: number | null; // % informado (modo pct) — no modo acertos é calculado
  notas: NotaDominio[];
  criadoEm: string;
}

export interface SimuladoInput {
  data: string;
  fonte: string;
  modo: ModoNota;
  geral: number | null;
  notas: NotaDominio[];
}

const prefix = (certId: string) => `SIM#${certId}#`;
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** % de um domínio no simulado (ou null se não informado). */
export function pctDominio(s: Simulado, dominioId: string): number | null {
  const n = s.notas.find((x) => x.dominioId === dominioId);
  if (!n) return null;
  if (s.modo === "pct") return n.pct;
  if (n.acertos === null || !n.total) return null;
  return Math.round((n.acertos / n.total) * 100);
}

/** % geral: informado (modo %) ou soma de acertos/total (modo acertos). */
export function pctGeral(s: Simulado): number | null {
  if (s.modo === "pct") return s.geral;
  let a = 0;
  let t = 0;
  for (const n of s.notas) {
    if (n.acertos !== null && n.total) {
      a += n.acertos;
      t += n.total;
    }
  }
  return t ? Math.round((a / t) * 100) : null;
}

export type Faixa = "baixa" | "media" | "alta";

/** Mesmas cores da sua planilha: < 70 vermelho, 70–79 amarelo, ≥ 80 verde. */
export function faixa(pct: number | null): Faixa | null {
  if (pct === null) return null;
  if (pct < 70) return "baixa";
  if (pct < 80) return "media";
  return "alta";
}

export function validateSimulado(
  input: SimuladoInput,
  dominios: Dominio[],
): { value?: SimuladoInput; errors: Partial<Record<"data" | "fonte" | "geral" | "notas", string>> } {
  const errors: Partial<Record<"data" | "fonte" | "geral" | "notas", string>> = {};
  const fonte = checkText(input.fonte, { label: "Fonte", max: 120 });
  if (!isDate(input.data)) errors.data = "Informe a data.";
  if (fonte.error) errors.fonte = fonte.error;
  if (input.modo === "pct" && input.geral !== null && (!Number.isFinite(input.geral) || input.geral < 0 || input.geral > 100))
    errors.geral = "A nota geral vai de 0 a 100.";

  const ids = new Set(dominios.map((d) => d.id));
  const notas: NotaDominio[] = [];
  for (const n of input.notas) {
    if (!ids.has(n.dominioId)) continue;
    if (input.modo === "pct") {
      if (n.pct === null) continue;
      if (!Number.isFinite(n.pct) || n.pct < 0 || n.pct > 100) {
        errors.notas = "Cada domínio vai de 0 a 100%.";
        break;
      }
      notas.push({ dominioId: n.dominioId, pct: n.pct, acertos: null, total: null });
    } else {
      if (n.acertos === null && n.total === null) continue;
      if (
        n.acertos === null ||
        n.total === null ||
        !Number.isInteger(n.acertos) ||
        !Number.isInteger(n.total) ||
        n.total <= 0 ||
        n.acertos < 0 ||
        n.acertos > n.total ||
        n.total > 1000
      ) {
        errors.notas = "Use números inteiros: acertos entre 0 e o total de questões.";
        break;
      }
      notas.push({ dominioId: n.dominioId, pct: null, acertos: n.acertos, total: n.total });
    }
  }
  if (!errors.notas && notas.length === 0 && (input.modo === "acertos" || input.geral === null))
    errors.notas = "Preencha pelo menos um domínio ou a nota geral.";

  if (Object.keys(errors).length) return { errors };
  return {
    value: {
      data: input.data,
      fonte: fonte.value,
      modo: input.modo,
      geral: input.modo === "pct" ? input.geral : null,
      notas,
    },
    errors,
  };
}

function fromItem(item: Item): Simulado | null {
  if (typeof item.sk !== "string") return null;
  const parts = item.sk.split("#"); // SIM, certId, data, id
  if (parts.length !== 4 || parts[0] !== "SIM" || !isDate(parts[2])) return null;
  const notas = Array.isArray(item.notas)
    ? item.notas
        .map((v) => {
          if (typeof v !== "object" || v === null) return null;
          const n = v as Record<string, unknown>;
          if (typeof n.dominioId !== "string") return null;
          return { dominioId: n.dominioId, pct: num(n.pct), acertos: num(n.acertos), total: num(n.total) };
        })
        .filter((n): n is NotaDominio => n !== null)
    : [];
  return {
    id: parts[3],
    certId: parts[1],
    data: parts[2],
    fonte: typeof item.fonte === "string" ? item.fonte : "",
    modo: item.modo === "acertos" ? "acertos" : "pct",
    geral: num(item.geral),
    notas,
    criadoEm: typeof item.criadoEm === "string" ? item.criadoEm : "",
  };
}

function toItem(s: Simulado): Item {
  return {
    sk: `${prefix(s.certId)}${s.data}#${s.id}`,
    tipo: "SIMULADO",
    fonte: s.fonte,
    modo: s.modo,
    geral: s.geral,
    notas: s.notas.map((n) => ({ ...n })),
    criadoEm: s.criadoEm,
  };
}

export function sortSimulados(list: Simulado[]): Simulado[] {
  return [...list].sort((a, b) => a.data.localeCompare(b.data) || a.criadoEm.localeCompare(b.criadoEm));
}

export async function listSimulados(db: Store, certId: string): Promise<Simulado[]> {
  const items = await db.queryPrefix(prefix(certId));
  return sortSimulados(items.map(fromItem).filter((s): s is Simulado => s !== null));
}

export async function createSimulado(db: Store, certId: string, input: SimuladoInput, criadoEm = nowIso()): Promise<Simulado> {
  const s: Simulado = { id: newId(), certId, ...input, criadoEm };
  await db.putItem(toItem(s), { mustNotExist: true });
  return s;
}

/** A data faz parte da chave: se mudar, grava o novo item e apaga o antigo. */
export async function updateSimulado(db: Store, old: Simulado, input: SimuladoInput): Promise<Simulado> {
  const next: Simulado = { ...old, ...input };
  await db.putItem(toItem(next));
  if (old.data !== next.data) await deleteSimulado(db, old);
  return next;
}

export async function deleteSimulado(db: Store, s: Simulado): Promise<void> {
  await db.deleteItem(`${prefix(s.certId)}${s.data}#${s.id}`);
}

export async function deleteAllSimulados(db: Store, certId: string): Promise<void> {
  for (const s of await listSimulados(db, certId)) await deleteSimulado(db, s);
}
