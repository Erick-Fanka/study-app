// Materiais e labs ligados a um curso (e, na Etapa 5, a uma certificação).
// Item: sk = MAT#<parentId>#<id>. Leitura: prefixo "MAT#<parentId>#".

import type { Store, Item } from "./store";
import type { IconName } from "../components/Icon";
import { checkText, checkUrl, newId, nowIso } from "./validate";

export type MaterialTipo = "link" | "pdf" | "video" | "doc" | "lab";

export const MATERIAL_TIPOS: Record<MaterialTipo, { label: string; icon: IconName; tone: string }> = {
  link: { label: "Link", icon: "link", tone: "blue" },
  pdf: { label: "PDF", icon: "file", tone: "orange" },
  video: { label: "Vídeo", icon: "play", tone: "purple" },
  doc: { label: "Documentação", icon: "book", tone: "teal" },
  lab: { label: "Lab prático", icon: "flask", tone: "green" },
};

export interface Material {
  id: string;
  parentId: string;
  tipo: MaterialTipo;
  titulo: string;
  url: string;
  feito: boolean;
  criadoEm: string;
}

export interface MaterialInput {
  tipo: MaterialTipo;
  titulo: string;
  url: string;
}

const isTipo = (v: unknown): v is MaterialTipo => typeof v === "string" && v in MATERIAL_TIPOS;

const prefix = (parentId: string) => `MAT#${parentId}#`;

export function validateMaterial(input: MaterialInput): {
  value?: MaterialInput;
  errors: Partial<Record<keyof MaterialInput, string>>;
} {
  const errors: Partial<Record<keyof MaterialInput, string>> = {};
  const titulo = checkText(input.titulo, { label: "Título", required: true, max: 150 });
  // Lab pode não ter link (ex.: lab feito na própria máquina).
  const url = checkUrl(input.url, { required: input.tipo !== "lab" });
  if (!isTipo(input.tipo)) errors.tipo = "Escolha um tipo.";
  if (titulo.error) errors.titulo = titulo.error;
  if (url.error) errors.url = url.error;
  if (Object.keys(errors).length) return { errors };
  return { value: { tipo: input.tipo, titulo: titulo.value, url: url.value }, errors };
}

function fromItem(item: Item): Material | null {
  if (typeof item.sk !== "string" || !item.sk.startsWith("MAT#")) return null;
  const [, parentId, id] = item.sk.split("#");
  if (!parentId || !id || typeof item.titulo !== "string") return null;
  return {
    id,
    parentId,
    tipo: isTipo(item.tipoMaterial) ? item.tipoMaterial : "link",
    titulo: item.titulo,
    url: typeof item.url === "string" ? item.url : "",
    feito: item.feito === true,
    criadoEm: typeof item.criadoEm === "string" ? item.criadoEm : "",
  };
}

export async function listMateriais(db: Store, parentId: string): Promise<Material[]> {
  const items = await db.queryPrefix(prefix(parentId));
  return items
    .map(fromItem)
    .filter((m): m is Material => m !== null)
    .sort((a, b) => a.criadoEm.localeCompare(b.criadoEm));
}

export async function createMaterial(db: Store, parentId: string, input: MaterialInput): Promise<Material> {
  const m: Material = { id: newId(), parentId, ...input, feito: false, criadoEm: nowIso() };
  await db.putItem(
    {
      sk: prefix(parentId) + m.id,
      tipo: "MATERIAL",
      tipoMaterial: m.tipo,
      titulo: m.titulo,
      url: m.url,
      feito: m.feito,
      criadoEm: m.criadoEm,
    },
    { mustNotExist: true },
  );
  return m;
}

export async function updateMaterial(db: Store, m: Material, input: MaterialInput): Promise<Material> {
  await db.updateItem(
    prefix(m.parentId) + m.id,
    { tipoMaterial: input.tipo, titulo: input.titulo, url: input.url },
    { mustExist: true },
  );
  return { ...m, ...input };
}

export async function setMaterialFeito(db: Store, m: Material, feito: boolean): Promise<void> {
  await db.updateItem(prefix(m.parentId) + m.id, { feito }, { mustExist: true });
}

export async function deleteMaterial(db: Store, m: Material): Promise<void> {
  await db.deleteItem(prefix(m.parentId) + m.id);
}

/** Apaga todos os materiais de um curso (usado ao apagar o curso). Um a um: a role não tem BatchWrite. */
export async function deleteAllMateriais(db: Store, parentId: string): Promise<void> {
  const list = await listMateriais(db, parentId);
  for (const m of list) await deleteMaterial(db, m);
}
