// Cursos. Item: sk = CURSO#<id>; os módulos ficam dentro do próprio item (lista),
// então uma leitura traz o curso inteiro. Leitura geral: prefixo "CURSO#".

import type { Store, Item } from "./store";
import { checkText, checkUrl, newId, nowIso } from "./validate";

export type CursoStatus = "planejado" | "em_andamento" | "pausado" | "concluido";
export type Prioridade = "alta" | "media" | "baixa";

export const STATUS: Record<CursoStatus, { label: string; tone: string }> = {
  planejado: { label: "Planejado", tone: "ink" },
  em_andamento: { label: "Em andamento", tone: "blue" },
  pausado: { label: "Pausado", tone: "amber" },
  concluido: { label: "Concluído", tone: "green" },
};

export const PRIORIDADE: Record<Prioridade, { label: string; tone: string }> = {
  alta: { label: "Alta", tone: "orange" },
  media: { label: "Média", tone: "blue" },
  baixa: { label: "Baixa", tone: "ink" },
};

export const PLATAFORMAS = [
  "Udemy",
  "AWS Skill Builder",
  "Cisco Networking Academy",
  "Cloudflare",
  "Coursera",
  "Alura",
  "Microsoft Learn",
  "YouTube",
];

export interface Modulo {
  id: string;
  titulo: string;
  concluido: boolean;
  concluidoEm: string | null;
}

export interface Curso {
  id: string;
  areaId: string;
  nome: string;
  plataforma: string;
  url: string;
  status: CursoStatus;
  prioridade: Prioridade;
  descricao: string;
  modulos: Modulo[];
  exemplo: boolean;
  criadoEm: string;
  atualizadoEm: string;
}

export interface CursoInput {
  areaId: string;
  nome: string;
  plataforma: string;
  url: string;
  status: CursoStatus;
  prioridade: Prioridade;
  descricao: string;
}

export type CursoErrors = Partial<Record<keyof CursoInput | "modulos", string>>;

const PREFIX = "CURSO#";
export const MAX_MODULOS = 300;
const MODULO_MAX = 150;

const isStatus = (v: unknown): v is CursoStatus => typeof v === "string" && v in STATUS;
const isPrioridade = (v: unknown): v is Prioridade => typeof v === "string" && v in PRIORIDADE;

export function validateCurso(input: CursoInput, areaIds: Set<string>): { value?: CursoInput; errors: CursoErrors } {
  const errors: CursoErrors = {};
  const nome = checkText(input.nome, { label: "Nome", required: true, max: 120 });
  const plataforma = checkText(input.plataforma, { label: "Plataforma", max: 60 });
  const url = checkUrl(input.url, { label: "Link do curso" });
  const descricao = checkText(input.descricao, { label: "Descrição", max: 500, multiline: true });
  if (nome.error) errors.nome = nome.error;
  if (plataforma.error) errors.plataforma = plataforma.error;
  if (url.error) errors.url = url.error;
  if (descricao.error) errors.descricao = descricao.error;
  if (!areaIds.has(input.areaId)) errors.areaId = "Escolha uma área.";
  if (!isStatus(input.status)) errors.status = "Status inválido.";
  if (!isPrioridade(input.prioridade)) errors.prioridade = "Prioridade inválida.";
  if (Object.keys(errors).length) return { errors };
  return {
    value: {
      areaId: input.areaId,
      nome: nome.value,
      plataforma: plataforma.value,
      url: url.value,
      status: input.status,
      prioridade: input.prioridade,
      descricao: descricao.value,
    },
    errors,
  };
}

/** Uma linha por módulo. Remove marcadores como "-", "*", "•". */
export function parseModuleLines(text: string): { titulos: string[]; error?: string } {
  const titulos = text
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*[-*•]\s+/, "").replace(/[\u0000-\u001F\u007F]/g, "").trim())
    .filter(Boolean);
  if (titulos.some((t) => t.length > MODULO_MAX)) {
    return { titulos, error: `Cada módulo pode ter no máximo ${MODULO_MAX} caracteres.` };
  }
  return { titulos };
}

export function checkModuloTitulo(value: string): { value: string; error?: string } {
  return checkText(value, { label: "Módulo", required: true, max: MODULO_MAX });
}

export function newModulos(titulos: string[]): Modulo[] {
  return titulos.map((titulo) => ({ id: newId(), titulo, concluido: false, concluidoEm: null }));
}

export function progress(c: Curso): { done: number; total: number; pct: number } {
  const total = c.modulos.length;
  const done = c.modulos.filter((m) => m.concluido).length;
  if (total === 0) return { done: 0, total: 0, pct: c.status === "concluido" ? 100 : 0 };
  return { done, total, pct: Math.round((done / total) * 100) };
}

export function nextModule(c: Curso): Modulo | undefined {
  return c.modulos.find((m) => !m.concluido);
}

/** Ajusta o status automaticamente conforme os módulos marcados. */
export function autoStatus(status: CursoStatus, modulos: Modulo[]): CursoStatus {
  const total = modulos.length;
  const done = modulos.filter((m) => m.concluido).length;
  if (total > 0 && done === total) return "concluido";
  if (done > 0 && (status === "planejado" || status === "concluido")) return "em_andamento";
  if (done === 0 && status === "concluido") return "planejado";
  return status;
}

const PRIO_ORDER: Record<Prioridade, number> = { alta: 0, media: 1, baixa: 2 };
const STATUS_ORDER: Record<CursoStatus, number> = { em_andamento: 0, planejado: 1, pausado: 2, concluido: 3 };

export function sortCursos(list: Curso[]): Curso[] {
  return [...list].sort(
    (a, b) =>
      STATUS_ORDER[a.status] - STATUS_ORDER[b.status] ||
      PRIO_ORDER[a.prioridade] - PRIO_ORDER[b.prioridade] ||
      a.nome.localeCompare(b.nome, "pt-BR"),
  );
}

function modFromItem(v: unknown): Modulo | null {
  if (typeof v !== "object" || v === null) return null;
  const m = v as Record<string, unknown>;
  if (typeof m.id !== "string" || typeof m.titulo !== "string") return null;
  return {
    id: m.id,
    titulo: m.titulo,
    concluido: m.concluido === true,
    concluidoEm: typeof m.concluidoEm === "string" ? m.concluidoEm : null,
  };
}

function fromItem(item: Item): Curso | null {
  if (typeof item.sk !== "string" || !item.sk.startsWith(PREFIX)) return null;
  if (typeof item.nome !== "string" || typeof item.areaId !== "string") return null;
  return {
    id: item.sk.slice(PREFIX.length),
    areaId: item.areaId,
    nome: item.nome,
    plataforma: typeof item.plataforma === "string" ? item.plataforma : "",
    url: typeof item.url === "string" ? item.url : "",
    status: isStatus(item.status) ? item.status : "planejado",
    prioridade: isPrioridade(item.prioridade) ? item.prioridade : "media",
    descricao: typeof item.descricao === "string" ? item.descricao : "",
    modulos: Array.isArray(item.modulos) ? item.modulos.map(modFromItem).filter((m): m is Modulo => m !== null) : [],
    exemplo: item.exemplo === true,
    criadoEm: typeof item.criadoEm === "string" ? item.criadoEm : "",
    atualizadoEm: typeof item.atualizadoEm === "string" ? item.atualizadoEm : "",
  };
}

function toItem(c: Curso): Item {
  return {
    sk: PREFIX + c.id,
    tipo: "CURSO",
    areaId: c.areaId,
    nome: c.nome,
    plataforma: c.plataforma,
    url: c.url,
    status: c.status,
    prioridade: c.prioridade,
    descricao: c.descricao,
    modulos: c.modulos.map((m) => ({ ...m })),
    exemplo: c.exemplo,
    criadoEm: c.criadoEm,
    atualizadoEm: c.atualizadoEm,
  };
}

export async function listCursos(db: Store): Promise<Curso[]> {
  const items = await db.queryPrefix(PREFIX);
  return sortCursos(items.map(fromItem).filter((c): c is Curso => c !== null));
}

export async function createCurso(db: Store, input: CursoInput, modulos: Modulo[]): Promise<Curso> {
  const now = nowIso();
  const curso: Curso = {
    id: newId(),
    ...input,
    status: autoStatus(input.status, modulos),
    modulos,
    exemplo: false,
    criadoEm: now,
    atualizadoEm: now,
  };
  await db.putItem(toItem(curso), { mustNotExist: true });
  return curso;
}

export async function updateCurso(db: Store, id: string, input: CursoInput): Promise<Curso> {
  const item = await db.updateItem(
    PREFIX + id,
    {
      areaId: input.areaId,
      nome: input.nome,
      plataforma: input.plataforma,
      url: input.url,
      status: input.status,
      prioridade: input.prioridade,
      descricao: input.descricao,
      atualizadoEm: nowIso(),
    },
    { mustExist: true },
  );
  const curso = fromItem(item);
  if (!curso) throw new Error("Resposta inesperada ao atualizar o curso.");
  return curso;
}

export async function saveModulos(db: Store, id: string, modulos: Modulo[], status: CursoStatus): Promise<void> {
  await db.updateItem(
    PREFIX + id,
    { modulos: modulos.map((m) => ({ ...m })), status, atualizadoEm: nowIso() },
    { mustExist: true },
  );
}

export async function deleteCurso(db: Store, id: string): Promise<void> {
  await db.deleteItem(PREFIX + id);
}
