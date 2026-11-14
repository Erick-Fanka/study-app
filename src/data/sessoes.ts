// Sessões de estudo. Item: sk = SES#<AAAA-MM-DDTHH:MM>#<id> (horário local),
// então a leitura por intervalo de datas já volta em ordem cronológica.

import type { Store, Item } from "./store";
import { checkText, newId, nowIso } from "./validate";
import { isDate, parseDate, toDateStr } from "./dates";

export type Origem = "cronometro" | "pomodoro" | "manual";
export type AlvoTipo = "curso" | "cert" | "livre";

export interface Alvo {
  tipo: AlvoTipo;
  id: string; // "" quando livre
  nome: string; // cópia do nome na hora do registro
  areaId: string;
}

export interface Sessao {
  id: string;
  inicio: string; // AAAA-MM-DDTHH:MM (local)
  minutos: number;
  alvo: Alvo;
  origem: Origem;
  nota: string;
  criadoEm: string;
}

export interface SessaoInput {
  inicio: string;
  minutos: number;
  alvo: Alvo;
  origem: Origem;
  nota: string;
}

export const MAX_MINUTOS = 12 * 60;
export const ALVO_LIVRE: Alvo = { tipo: "livre", id: "", nome: "Estudo livre", areaId: "" };

const INICIO = /^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d$/;

export function isInicio(v: unknown): v is string {
  return typeof v === "string" && INICIO.test(v) && isDate(v.slice(0, 10));
}

export function inicioFromDate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${toDateStr(d)}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function inicioToDate(s: string): Date {
  const d = parseDate(s.slice(0, 10));
  d.setHours(Number(s.slice(11, 13)), Number(s.slice(14, 16)));
  return d;
}

export function fimDe(s: Sessao): Date {
  return new Date(inicioToDate(s.inicio).getTime() + s.minutos * 60_000);
}

export function fmtDuracao(min: number): string {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h}h` : `${h}h ${String(m).padStart(2, "0")}min`;
}

export function fmtHora(d: Date): string {
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export function validateSessao(input: SessaoInput): { value?: SessaoInput; errors: Partial<Record<"inicio" | "minutos" | "nota" | "alvo", string>> } {
  const errors: Partial<Record<"inicio" | "minutos" | "nota" | "alvo", string>> = {};
  const nota = checkText(input.nota, { label: "Observação", max: 200, multiline: true });
  if (!isInicio(input.inicio)) errors.inicio = "Informe a data e o horário de início.";
  if (!Number.isInteger(input.minutos) || input.minutos < 1 || input.minutos > MAX_MINUTOS)
    errors.minutos = `A duração vai de 1 minuto a ${MAX_MINUTOS / 60} horas.`;
  if (nota.error) errors.nota = nota.error;
  if (!["curso", "cert", "livre"].includes(input.alvo.tipo)) errors.alvo = "Escolha o que você estudou.";
  if (Object.keys(errors).length) return { errors };
  return { value: { ...input, nota: nota.value }, errors };
}

function alvoFromItem(v: unknown): Alvo {
  if (typeof v !== "object" || v === null) return { ...ALVO_LIVRE };
  const a = v as Record<string, unknown>;
  const tipo = a.tipo === "curso" || a.tipo === "cert" ? a.tipo : "livre";
  return {
    tipo,
    id: tipo === "livre" ? "" : String(a.id ?? ""),
    nome: typeof a.nome === "string" && a.nome ? a.nome : ALVO_LIVRE.nome,
    areaId: typeof a.areaId === "string" ? a.areaId : "",
  };
}

function fromItem(item: Item): Sessao | null {
  if (typeof item.sk !== "string") return null;
  const parts = item.sk.split("#"); // SES, inicio, id
  if (parts.length !== 3 || parts[0] !== "SES" || !isInicio(parts[1])) return null;
  const minutos = typeof item.minutos === "number" ? item.minutos : 0;
  if (minutos <= 0) return null;
  const origem = item.origem === "cronometro" || item.origem === "pomodoro" ? item.origem : "manual";
  return {
    id: parts[2],
    inicio: parts[1],
    minutos,
    alvo: alvoFromItem(item.alvo),
    origem,
    nota: typeof item.nota === "string" ? item.nota : "",
    criadoEm: typeof item.criadoEm === "string" ? item.criadoEm : "",
  };
}

const skOf = (s: Pick<Sessao, "inicio" | "id">) => `SES#${s.inicio}#${s.id}`;

function toItem(s: Sessao): Item {
  return {
    sk: skOf(s),
    tipo: "SESSAO",
    minutos: s.minutos,
    alvo: { ...s.alvo },
    origem: s.origem,
    nota: s.nota,
    criadoEm: s.criadoEm,
  };
}

/** Sessões que começam entre as duas datas (inclusive), em ordem cronológica. */
export async function listSessoes(db: Store, de: string, ate: string): Promise<Sessao[]> {
  const items = await db.queryRange(`SES#${de}`, `SES#${ate}T99`);
  return items.map(fromItem).filter((s): s is Sessao => s !== null);
}

export async function createSessao(db: Store, input: SessaoInput): Promise<Sessao> {
  const s: Sessao = { id: newId(), ...input, criadoEm: nowIso() };
  await db.putItem(toItem(s), { mustNotExist: true });
  return s;
}

/** O início faz parte da chave: se mudar, grava o novo item e apaga o antigo. */
export async function updateSessao(db: Store, old: Sessao, input: SessaoInput): Promise<Sessao> {
  const next: Sessao = { ...old, ...input };
  await db.putItem(toItem(next));
  if (old.inicio !== next.inicio) await db.deleteItem(skOf(old));
  return next;
}

export async function deleteSessao(db: Store, s: Sessao): Promise<void> {
  await db.deleteItem(skOf(s));
}

/** Segunda-feira da semana da data. */
export function inicioSemana(d: Date = new Date()): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dow = (x.getDay() + 6) % 7; // 0 = segunda
  x.setDate(x.getDate() - dow);
  return x;
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export function somaMinutos(list: Sessao[]): number {
  return list.reduce((s, x) => s + x.minutos, 0);
}
