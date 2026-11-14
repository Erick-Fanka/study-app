// Certificações. Item: sk = CERT#<id>. Domínios (com peso) e dados da prova ficam
// dentro do item. Leitura geral: prefixo "CERT#".

import type { Store, Item } from "./store";
import { checkText, checkUrl, newId, nowIso } from "./validate";
import { daysUntil, isDate } from "./dates";

export type CertStatus = "estudando" | "agendada" | "aprovada" | "expirada";

export const CERT_STATUS: Record<CertStatus, { label: string; tone: string }> = {
  estudando: { label: "Estudando", tone: "blue" },
  agendada: { label: "Prova agendada", tone: "orange" },
  aprovada: { label: "Aprovada", tone: "green" },
  expirada: { label: "Expirada", tone: "red" },
};

export const EMISSORES = ["AWS", "Cisco", "Microsoft", "Google Cloud", "Cloudflare", "CompTIA", "ISC2", "EC-Council", "Linux Foundation"];

export interface Dominio {
  id: string;
  nome: string;
  peso: number; // % do exame (0 a 100)
}

export interface Prova {
  data: string; // AAAA-MM-DD ou ""
  hora: string; // HH:MM ou ""
  modalidade: "" | "online" | "presencial";
  local: string;
  voucher: string;
  voucherValidade: string; // AAAA-MM-DD ou ""
  nota: number | null;
  notaMinima: number | null;
  notaMaxima: number | null;
}

export interface Cert {
  id: string;
  areaId: string; // "" = sem área
  nome: string;
  codigo: string;
  emissor: string;
  status: CertStatus;
  dominios: Dominio[];
  prova: Prova;
  credencialUrl: string;
  emitidaEm: string; // AAAA-MM-DD ou ""
  expiraEm: string; // AAAA-MM-DD ou ""
  exemplo: boolean;
  criadoEm: string;
  atualizadoEm: string;
}

export type CertInput = Omit<Cert, "id" | "prova" | "exemplo" | "criadoEm" | "atualizadoEm">;
export type CertErrors = Partial<Record<keyof CertInput | "dominiosLista", string>>;

export const EMPTY_PROVA: Prova = {
  data: "",
  hora: "",
  modalidade: "",
  local: "",
  voucher: "",
  voucherValidade: "",
  nota: null,
  notaMinima: null,
  notaMaxima: null,
};

const PREFIX = "CERT#";
const MAX_DOMINIOS = 20;

const isStatus = (v: unknown): v is CertStatus => typeof v === "string" && v in CERT_STATUS;
const optDate = (v: unknown) => (isDate(v) ? v : "");
const optNum = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
const str = (v: unknown) => (typeof v === "string" ? v : "");

export function pesoTotal(d: Dominio[]): number {
  return Math.round(d.reduce((s, x) => s + x.peso, 0) * 10) / 10;
}

export function validateCert(input: CertInput, areaIds: Set<string>): { value?: CertInput; errors: CertErrors } {
  const errors: CertErrors = {};
  const nome = checkText(input.nome, { label: "Nome", required: true, max: 120 });
  const codigo = checkText(input.codigo, { label: "Código", max: 30 });
  const emissor = checkText(input.emissor, { label: "Emissor", max: 60 });
  const cred = checkUrl(input.credencialUrl, { label: "Link da credencial" });
  if (nome.error) errors.nome = nome.error;
  if (codigo.error) errors.codigo = codigo.error;
  if (emissor.error) errors.emissor = emissor.error;
  if (cred.error) errors.credencialUrl = cred.error;
  if (input.areaId && !areaIds.has(input.areaId)) errors.areaId = "Área inválida.";
  if (!isStatus(input.status)) errors.status = "Status inválido.";
  if (input.emitidaEm && !isDate(input.emitidaEm)) errors.emitidaEm = "Data inválida.";
  if (input.expiraEm && !isDate(input.expiraEm)) errors.expiraEm = "Data inválida.";
  if (input.emitidaEm && input.expiraEm && input.expiraEm < input.emitidaEm)
    errors.expiraEm = "A validade não pode ser antes da emissão.";

  const dominios: Dominio[] = [];
  if (input.dominios.length > MAX_DOMINIOS) errors.dominiosLista = `No máximo ${MAX_DOMINIOS} domínios.`;
  for (const d of input.dominios) {
    const n = checkText(d.nome, { label: "Nome do domínio", required: true, max: 80 });
    if (n.error) {
      errors.dominiosLista = "Todo domínio precisa de um nome (até 80 caracteres).";
      break;
    }
    if (!Number.isFinite(d.peso) || d.peso < 0 || d.peso > 100) {
      errors.dominiosLista = "O peso de cada domínio deve ficar entre 0 e 100.";
      break;
    }
    dominios.push({ id: d.id, nome: n.value, peso: d.peso });
  }

  if (Object.keys(errors).length) return { errors };
  return {
    value: {
      areaId: input.areaId,
      nome: nome.value,
      codigo: codigo.value,
      emissor: emissor.value,
      status: input.status,
      dominios,
      credencialUrl: cred.value,
      emitidaEm: input.emitidaEm,
      expiraEm: input.expiraEm,
    },
    errors,
  };
}

export function validateProva(p: Prova): { value?: Prova; errors: Partial<Record<keyof Prova, string>> } {
  const errors: Partial<Record<keyof Prova, string>> = {};
  const local = checkText(p.local, { label: "Local", max: 120 });
  const voucher = checkText(p.voucher, { label: "Voucher", max: 60 });
  if (p.data && !isDate(p.data)) errors.data = "Data inválida.";
  if (p.hora && !/^([01]\d|2[0-3]):[0-5]\d$/.test(p.hora)) errors.hora = "Hora inválida.";
  if (p.voucherValidade && !isDate(p.voucherValidade)) errors.voucherValidade = "Data inválida.";
  if (local.error) errors.local = local.error;
  if (voucher.error) errors.voucher = voucher.error;
  for (const k of ["nota", "notaMinima", "notaMaxima"] as const) {
    const v = p[k];
    if (v !== null && (!Number.isFinite(v) || v < 0 || v > 100000)) errors[k] = "Número inválido.";
  }
  if (Object.keys(errors).length) return { errors };
  return { value: { ...p, local: local.value, voucher: voucher.value }, errors };
}

/** Alerta de validade: dias até expirar, se houver data. */
export function validadeInfo(c: Cert): { dias: number; nivel: "ok" | "aviso" | "vencida" } | null {
  if (!c.expiraEm) return null;
  const dias = daysUntil(c.expiraEm);
  return { dias, nivel: dias < 0 ? "vencida" : dias <= 90 ? "aviso" : "ok" };
}

function provaFromItem(v: unknown): Prova {
  if (typeof v !== "object" || v === null) return { ...EMPTY_PROVA };
  const p = v as Record<string, unknown>;
  return {
    data: optDate(p.data),
    hora: typeof p.hora === "string" && /^\d{2}:\d{2}$/.test(p.hora) ? p.hora : "",
    modalidade: p.modalidade === "online" || p.modalidade === "presencial" ? p.modalidade : "",
    local: str(p.local),
    voucher: str(p.voucher),
    voucherValidade: optDate(p.voucherValidade),
    nota: optNum(p.nota),
    notaMinima: optNum(p.notaMinima),
    notaMaxima: optNum(p.notaMaxima),
  };
}

function domFromItem(v: unknown): Dominio | null {
  if (typeof v !== "object" || v === null) return null;
  const d = v as Record<string, unknown>;
  if (typeof d.id !== "string" || typeof d.nome !== "string") return null;
  return { id: d.id, nome: d.nome, peso: typeof d.peso === "number" ? d.peso : 0 };
}

function fromItem(item: Item): Cert | null {
  if (typeof item.sk !== "string" || !item.sk.startsWith(PREFIX) || typeof item.nome !== "string") return null;
  return {
    id: item.sk.slice(PREFIX.length),
    areaId: str(item.areaId),
    nome: item.nome,
    codigo: str(item.codigo),
    emissor: str(item.emissor),
    status: isStatus(item.status) ? item.status : "estudando",
    dominios: Array.isArray(item.dominios) ? item.dominios.map(domFromItem).filter((d): d is Dominio => d !== null) : [],
    prova: provaFromItem(item.prova),
    credencialUrl: str(item.credencialUrl),
    emitidaEm: optDate(item.emitidaEm),
    expiraEm: optDate(item.expiraEm),
    exemplo: item.exemplo === true,
    criadoEm: str(item.criadoEm),
    atualizadoEm: str(item.atualizadoEm),
  };
}

const STATUS_ORDER: Record<CertStatus, number> = { agendada: 0, estudando: 1, aprovada: 2, expirada: 3 };

export function sortCerts(list: Cert[]): Cert[] {
  return [...list].sort(
    (a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || a.nome.localeCompare(b.nome, "pt-BR"),
  );
}

export async function listCerts(db: Store): Promise<Cert[]> {
  const items = await db.queryPrefix(PREFIX);
  return sortCerts(items.map(fromItem).filter((c): c is Cert => c !== null));
}

function toItem(c: Cert): Item {
  return {
    sk: PREFIX + c.id,
    tipo: "CERT",
    areaId: c.areaId,
    nome: c.nome,
    codigo: c.codigo,
    emissor: c.emissor,
    status: c.status,
    dominios: c.dominios.map((d) => ({ ...d })),
    prova: { ...c.prova },
    credencialUrl: c.credencialUrl,
    emitidaEm: c.emitidaEm,
    expiraEm: c.expiraEm,
    exemplo: c.exemplo,
    criadoEm: c.criadoEm,
    atualizadoEm: c.atualizadoEm,
  };
}

export async function createCert(db: Store, input: CertInput, prova: Prova = EMPTY_PROVA): Promise<Cert> {
  const now = nowIso();
  const cert: Cert = { id: newId(), ...input, prova: { ...prova }, exemplo: false, criadoEm: now, atualizadoEm: now };
  await db.putItem(toItem(cert), { mustNotExist: true });
  return cert;
}

export async function updateCert(db: Store, cert: Cert, input: CertInput): Promise<Cert> {
  const next: Cert = { ...cert, ...input, atualizadoEm: nowIso() };
  await db.putItem(toItem(next), { mustExist: true });
  return next;
}

export async function updateProva(db: Store, cert: Cert, prova: Prova): Promise<Cert> {
  await db.updateItem(PREFIX + cert.id, { prova: { ...prova }, atualizadoEm: nowIso() }, { mustExist: true });
  return { ...cert, prova };
}

export async function deleteCert(db: Store, id: string): Promise<void> {
  await db.deleteItem(PREFIX + id);
}

export function newDominios(lista: [string, number][]): Dominio[] {
  return lista.map(([nome, peso]) => ({ id: newId(), nome, peso }));
}
