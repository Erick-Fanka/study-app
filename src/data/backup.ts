// Backup: exporta todos os dados para um arquivo JSON e importa de volta.
// A importação só aceita os tipos de item do site.

import type { Store, Item } from "./store";

export const BACKUP_APP = "estudos-app";
export const BACKUP_VERSAO = 1;
const MAX_ITENS = 20000;
const MAX_ITEM_CHARS = 350_000; // limite por item, para barrar arquivos adulterados

const SK_PERMITIDO = /^(AREA|CURSO|MAT|CERT|SIM|SES|EVT|REC)#[^\u0000-\u001F]{1,300}$|^PERFIL(#FOTO)?$/;

export const TIPOS_LABEL: Record<string, string> = {
  AREA: "Áreas",
  CURSO: "Cursos",
  MAT: "Materiais e labs",
  CERT: "Certificações",
  SIM: "Simulados",
  SES: "Sessões de estudo",
  EVT: "Eventos da agenda",
  REC: "Blocos semanais",
  PERFIL: "Perfil",
};

export interface Backup {
  app: string;
  versao: number;
  exportadoEm: string;
  total: number;
  itens: Item[];
}

export function tipoDe(sk: string): string {
  return sk.split("#")[0];
}

export function contar(itens: Item[]): Record<string, number> {
  const c: Record<string, number> = {};
  for (const it of itens) {
    const t = tipoDe(String(it.sk));
    c[t] = (c[t] ?? 0) + 1;
  }
  return c;
}

export async function exportar(db: Store): Promise<Backup> {
  const itens = (await db.all()).filter((it) => typeof it.sk === "string" && it.sk !== "CRONO");
  return { app: BACKUP_APP, versao: BACKUP_VERSAO, exportadoEm: new Date().toISOString(), total: itens.length, itens };
}

export function baixarJson(nome: string, dados: unknown): void {
  const blob = new Blob([JSON.stringify(dados, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Valida o arquivo antes de importar. Retorna os itens aceitos ou uma mensagem de erro. */
export function validarBackup(texto: string): { itens?: Item[]; erro?: string; ignorados?: number } {
  let dados: unknown;
  try {
    dados = JSON.parse(texto);
  } catch {
    return { erro: "O arquivo não é um JSON válido." };
  }
  if (typeof dados !== "object" || dados === null) return { erro: "Formato de backup inválido." };
  const b = dados as Partial<Backup>;
  if (b.app !== BACKUP_APP) return { erro: "Este arquivo não é um backup deste site." };
  if (b.versao !== BACKUP_VERSAO) return { erro: "Versão de backup não suportada." };
  if (!Array.isArray(b.itens)) return { erro: "O backup não tem itens." };
  if (b.itens.length > MAX_ITENS) return { erro: `Backup grande demais (máximo ${MAX_ITENS} itens).` };

  const itens: Item[] = [];
  let ignorados = 0;
  for (const raw of b.itens) {
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
      ignorados++;
      continue;
    }
    const { pk: _pk, ...item } = raw as Item;
    if (typeof item.sk !== "string" || !SK_PERMITIDO.test(item.sk)) {
      ignorados++;
      continue;
    }
    if (JSON.stringify(item).length > MAX_ITEM_CHARS) {
      ignorados++;
      continue;
    }
    itens.push(item);
  }
  if (itens.length === 0) return { erro: "Nenhum item válido no backup." };
  return { itens, ignorados };
}

/** Grava os itens um a um, informando o progresso. */
export async function importar(db: Store, itens: Item[], onProgress: (feitos: number) => void): Promise<void> {
  let feitos = 0;
  for (const item of itens) {
    await db.putItem(item);
    feitos++;
    onProgress(feitos);
  }
}
