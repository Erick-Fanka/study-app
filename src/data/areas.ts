// Áreas (ex.: Cloud, Redes, Segurança). Item: sk = AREA#<id>.
// Leitura: todos os itens com prefixo "AREA#".

import type { Store, Item } from "./store";
import { checkText, newId, nowIso } from "./validate";

export const AREA_COLORS = [
  { id: "orange", label: "Laranja" },
  { id: "blue", label: "Azul" },
  { id: "green", label: "Verde" },
  { id: "ink", label: "Preto" },
  { id: "sky", label: "Azul-claro" },
  { id: "teal", label: "Verde-água" },
  { id: "amber", label: "Âmbar" },
  { id: "purple", label: "Roxo" },
] as const;

export type AreaColor = (typeof AREA_COLORS)[number]["id"];

const COLOR_IDS = new Set<string>(AREA_COLORS.map((c) => c.id));

export interface Area {
  id: string;
  nome: string;
  descricao: string;
  cor: AreaColor;
  ordem: number;
  exemplo: boolean;
  criadoEm: string;
  atualizadoEm: string;
}

export interface AreaInput {
  nome: string;
  descricao: string;
  cor: AreaColor;
}

const PREFIX = "AREA#";

export function validateArea(input: AreaInput): { value?: AreaInput; errors: Partial<Record<keyof AreaInput, string>> } {
  const nome = checkText(input.nome, { label: "Nome", required: true, max: 60 });
  const descricao = checkText(input.descricao, { label: "Descrição", max: 200, multiline: true });
  const errors: Partial<Record<keyof AreaInput, string>> = {};
  if (nome.error) errors.nome = nome.error;
  if (descricao.error) errors.descricao = descricao.error;
  if (!COLOR_IDS.has(input.cor)) errors.cor = "Escolha uma cor.";
  if (Object.keys(errors).length > 0) return { errors };
  return { value: { nome: nome.value, descricao: descricao.value, cor: input.cor }, errors };
}

function fromItem(item: Item): Area | null {
  if (typeof item.sk !== "string" || !item.sk.startsWith(PREFIX)) return null;
  if (typeof item.nome !== "string") return null;
  return {
    id: item.sk.slice(PREFIX.length),
    nome: item.nome,
    descricao: typeof item.descricao === "string" ? item.descricao : "",
    cor: COLOR_IDS.has(String(item.cor)) ? (item.cor as AreaColor) : "orange",
    ordem: typeof item.ordem === "number" ? item.ordem : 0,
    exemplo: item.exemplo === true,
    criadoEm: typeof item.criadoEm === "string" ? item.criadoEm : "",
    atualizadoEm: typeof item.atualizadoEm === "string" ? item.atualizadoEm : "",
  };
}

export function sortAreas(list: Area[]): Area[] {
  return [...list].sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome, "pt-BR"));
}

export async function listAreas(db: Store): Promise<Area[]> {
  const items = await db.queryPrefix(PREFIX);
  return sortAreas(items.map(fromItem).filter((a): a is Area => a !== null));
}

export async function createArea(db: Store, input: AreaInput, ordem: number): Promise<Area> {
  const now = nowIso();
  const area: Area = { id: newId(), ...input, ordem, exemplo: false, criadoEm: now, atualizadoEm: now };
  await db.putItem(
    {
      sk: PREFIX + area.id,
      tipo: "AREA",
      nome: area.nome,
      descricao: area.descricao,
      cor: area.cor,
      ordem: area.ordem,
      exemplo: area.exemplo,
      criadoEm: area.criadoEm,
      atualizadoEm: area.atualizadoEm,
    },
    { mustNotExist: true },
  );
  return area;
}

export async function updateArea(db: Store, id: string, input: AreaInput): Promise<Area> {
  const item = await db.updateItem(
    PREFIX + id,
    { nome: input.nome, descricao: input.descricao, cor: input.cor, atualizadoEm: nowIso() },
    { mustExist: true },
  );
  const area = fromItem(item);
  if (!area) throw new Error("Resposta inesperada ao atualizar a área.");
  return area;
}

export async function setAreaOrder(db: Store, id: string, ordem: number): Promise<void> {
  await db.updateItem(PREFIX + id, { ordem }, { mustExist: true });
}

export async function deleteArea(db: Store, id: string): Promise<void> {
  await db.deleteItem(PREFIX + id);
}
