// Agenda.
// - Evento único: sk = EVT#<AAAA-MM-DD>T<HH:MM ou -->#<id>  (leitura por intervalo de datas)
// - Bloco semanal: sk = REC#<id>                            (poucos itens; lidos todos)
// Provas, vouchers e validades vêm das certificações; o histórico vem das sessões.

import type { Store, Item } from "./store";
import type { Cert } from "./certs";
import { ALVO_LIVRE, type Alvo, type Sessao } from "./sessoes";
import { checkText, newId, nowIso } from "./validate";
import { isDate, parseDate, toDateStr } from "./dates";

export type EventoTipo = "bloco" | "prazo";

export interface Evento {
  id: string;
  tipo: EventoTipo;
  titulo: string;
  data: string; // AAAA-MM-DD
  hora: string; // HH:MM ou "" (dia inteiro)
  duracaoMin: number; // blocos
  alvo: Alvo;
  nota: string;
  concluido: boolean; // prazos
  criadoEm: string;
}

export interface Recorrente {
  id: string;
  titulo: string;
  hora: string; // HH:MM
  duracaoMin: number;
  dias: number[]; // 0 = segunda … 6 = domingo
  desde: string; // AAAA-MM-DD
  ate: string; // AAAA-MM-DD ou ""
  alvo: Alvo;
  nota: string;
  criadoEm: string;
}

export interface EventoInput {
  tipo: EventoTipo;
  titulo: string;
  data: string;
  hora: string;
  duracaoMin: number;
  alvo: Alvo;
  nota: string;
  repetir: boolean;
  dias: number[];
  ate: string;
}

export type ItemKind = "bloco" | "prazo" | "prova" | "voucher" | "validade" | "sessao";

export interface AgendaItem {
  key: string;
  kind: ItemKind;
  data: string;
  hora: string; // "" = dia inteiro
  fim: string; // HH:MM ou ""
  titulo: string;
  detalhe: string;
  href?: string;
  evento?: Evento;
  recorrente?: Recorrente;
  sessao?: Sessao;
  minutos?: number;
  concluido?: boolean;
}

export const KIND: Record<ItemKind, { label: string; tone: string }> = {
  bloco: { label: "Estudo", tone: "blue" },
  prazo: { label: "Prazo", tone: "orange" },
  prova: { label: "Prova", tone: "red" },
  voucher: { label: "Voucher", tone: "amber" },
  validade: { label: "Validade", tone: "purple" },
  sessao: { label: "Estudado", tone: "green" },
};

const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;
export const DIAS_CURTOS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

export function diaSemana(data: string): number {
  return (parseDate(data).getDay() + 6) % 7;
}

export function somaHora(hora: string, min: number): string {
  const [h, m] = hora.split(":").map(Number);
  const t = Math.min(23 * 60 + 59, h * 60 + m + min);
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
}

export function validateEvento(input: EventoInput): {
  value?: EventoInput;
  errors: Partial<Record<"titulo" | "data" | "hora" | "duracaoMin" | "dias" | "ate" | "nota", string>>;
} {
  const errors: Partial<Record<"titulo" | "data" | "hora" | "duracaoMin" | "dias" | "ate" | "nota", string>> = {};
  const titulo = checkText(input.titulo, { label: "Título", required: true, max: 120 });
  const nota = checkText(input.nota, { label: "Observação", max: 300, multiline: true });
  if (titulo.error) errors.titulo = titulo.error;
  if (nota.error) errors.nota = nota.error;
  if (!isDate(input.data)) errors.data = input.repetir ? "Informe a partir de quando." : "Informe a data.";
  const bloco = input.tipo === "bloco";
  if (bloco || input.hora) {
    if (!HORA.test(input.hora)) errors.hora = "Informe o horário.";
  }
  if (bloco && (!Number.isInteger(input.duracaoMin) || input.duracaoMin < 5 || input.duracaoMin > 12 * 60))
    errors.duracaoMin = "A duração vai de 5 minutos a 12 horas.";
  if (bloco && input.repetir) {
    if (input.dias.length === 0) errors.dias = "Escolha pelo menos um dia da semana.";
    if (input.ate && (!isDate(input.ate) || input.ate < input.data)) errors.ate = "A data final deve ser depois do início.";
  }
  if (Object.keys(errors).length) return { errors };
  return {
    value: {
      ...input,
      titulo: titulo.value,
      nota: nota.value,
      repetir: bloco && input.repetir,
      dias: [...new Set(input.dias)].filter((d) => d >= 0 && d <= 6).sort(),
    },
    errors,
  };
}

/* ---------------- Leitura e gravação ---------------- */

function alvoFrom(v: unknown): Alvo {
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

const num = (v: unknown, d: number) => (typeof v === "number" && Number.isFinite(v) ? v : d);
const str = (v: unknown) => (typeof v === "string" ? v : "");

function eventoFromItem(item: Item): Evento | null {
  if (typeof item.sk !== "string") return null;
  const m = /^EVT#(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}|--)#(.+)$/.exec(item.sk);
  if (!m || !isDate(m[1])) return null;
  return {
    id: m[3],
    tipo: item.tipoEvento === "bloco" ? "bloco" : "prazo",
    titulo: str(item.titulo) || "Sem título",
    data: m[1],
    hora: m[2] === "--" ? "" : m[2],
    duracaoMin: num(item.duracaoMin, 60),
    alvo: alvoFrom(item.alvo),
    nota: str(item.nota),
    concluido: item.concluido === true,
    criadoEm: str(item.criadoEm),
  };
}

function recFromItem(item: Item): Recorrente | null {
  if (typeof item.sk !== "string" || !item.sk.startsWith("REC#")) return null;
  const hora = str(item.hora);
  const desde = str(item.desde);
  if (!HORA.test(hora) || !isDate(desde)) return null;
  return {
    id: item.sk.slice(4),
    titulo: str(item.titulo) || "Estudo",
    hora,
    duracaoMin: num(item.duracaoMin, 60),
    dias: Array.isArray(item.dias) ? item.dias.filter((d): d is number => typeof d === "number" && d >= 0 && d <= 6) : [],
    desde,
    ate: isDate(item.ate) ? (item.ate as string) : "",
    alvo: alvoFrom(item.alvo),
    nota: str(item.nota),
    criadoEm: str(item.criadoEm),
  };
}

const evtSk = (e: Pick<Evento, "data" | "hora" | "id">) => `EVT#${e.data}T${e.hora || "--"}#${e.id}`;

export async function listEventos(db: Store, de: string, ate: string): Promise<Evento[]> {
  const items = await db.queryRange(`EVT#${de}`, `EVT#${ate}T99`);
  return items.map(eventoFromItem).filter((e): e is Evento => e !== null);
}

export async function listRecorrentes(db: Store): Promise<Recorrente[]> {
  const items = await db.queryPrefix("REC#");
  return items.map(recFromItem).filter((r): r is Recorrente => r !== null);
}

function eventoItem(e: Evento): Item {
  return {
    sk: evtSk(e),
    tipo: "EVENTO",
    tipoEvento: e.tipo,
    titulo: e.titulo,
    duracaoMin: e.duracaoMin,
    alvo: { ...e.alvo },
    nota: e.nota,
    concluido: e.concluido,
    criadoEm: e.criadoEm,
  };
}

function recItem(r: Recorrente): Item {
  return {
    sk: `REC#${r.id}`,
    tipo: "RECORRENTE",
    titulo: r.titulo,
    hora: r.hora,
    duracaoMin: r.duracaoMin,
    dias: [...r.dias],
    desde: r.desde,
    ate: r.ate,
    alvo: { ...r.alvo },
    nota: r.nota,
    criadoEm: r.criadoEm,
  };
}

/** Cria (ou substitui) a partir do formulário. Trocar entre único e semanal apaga o antigo. */
export async function saveEvento(
  db: Store,
  input: EventoInput,
  old?: { evento?: Evento; recorrente?: Recorrente },
): Promise<void> {
  const criadoEm = old?.evento?.criadoEm || old?.recorrente?.criadoEm || nowIso();
  if (input.repetir) {
    const r: Recorrente = {
      id: old?.recorrente?.id ?? newId(),
      titulo: input.titulo,
      hora: input.hora,
      duracaoMin: input.duracaoMin,
      dias: input.dias,
      desde: input.data,
      ate: input.ate,
      alvo: input.alvo,
      nota: input.nota,
      criadoEm,
    };
    await db.putItem(recItem(r));
    if (old?.evento) await db.deleteItem(evtSk(old.evento));
  } else {
    const e: Evento = {
      id: old?.evento?.id ?? newId(),
      tipo: input.tipo,
      titulo: input.titulo,
      data: input.data,
      hora: input.hora,
      duracaoMin: input.tipo === "bloco" ? input.duracaoMin : 0,
      alvo: input.alvo,
      nota: input.nota,
      concluido: old?.evento?.concluido ?? false,
      criadoEm,
    };
    await db.putItem(eventoItem(e));
    if (old?.evento && evtSk(old.evento) !== evtSk(e)) await db.deleteItem(evtSk(old.evento));
    if (old?.recorrente) await db.deleteItem(`REC#${old.recorrente.id}`);
  }
}

export async function setConcluido(db: Store, e: Evento, concluido: boolean): Promise<void> {
  await db.updateItem(evtSk(e), { concluido }, { mustExist: true });
}

export async function deleteEvento(db: Store, e: Evento): Promise<void> {
  await db.deleteItem(evtSk(e));
}

export async function deleteRecorrente(db: Store, r: Recorrente): Promise<void> {
  await db.deleteItem(`REC#${r.id}`);
}

/* ---------------- Montagem dos itens de um período ---------------- */

function eachDay(de: string, ate: string, fn: (d: string) => void) {
  const d = parseDate(de);
  const end = parseDate(ate);
  while (d <= end) {
    fn(toDateStr(d));
    d.setDate(d.getDate() + 1);
  }
}

export function buildItems(
  de: string,
  ate: string,
  src: { eventos: Evento[]; recorrentes: Recorrente[]; certs: Cert[]; sessoes: Sessao[] },
): AgendaItem[] {
  const out: AgendaItem[] = [];
  const dentro = (d: string) => d >= de && d <= ate;

  for (const e of src.eventos) {
    if (!dentro(e.data)) continue;
    out.push({
      key: `e-${e.id}`,
      kind: e.tipo,
      data: e.data,
      hora: e.hora,
      fim: e.tipo === "bloco" && e.hora ? somaHora(e.hora, e.duracaoMin) : "",
      titulo: e.titulo,
      detalhe: e.alvo.tipo !== "livre" ? e.alvo.nome : "",
      evento: e,
      concluido: e.tipo === "prazo" ? e.concluido : undefined,
    });
  }

  for (const r of src.recorrentes) {
    eachDay(de > r.desde ? de : r.desde, r.ate && r.ate < ate ? r.ate : ate, (d) => {
      if (!r.dias.includes(diaSemana(d))) return;
      out.push({
        key: `r-${r.id}-${d}`,
        kind: "bloco",
        data: d,
        hora: r.hora,
        fim: somaHora(r.hora, r.duracaoMin),
        titulo: r.titulo,
        detalhe: `${r.alvo.tipo !== "livre" ? `${r.alvo.nome} · ` : ""}toda semana`,
        recorrente: r,
      });
    });
  }

  for (const c of src.certs) {
    const nome = c.codigo || c.nome;
    const href = `/certificacoes/${c.id}`;
    if (c.prova.data && dentro(c.prova.data) && c.status !== "aprovada") {
      out.push({
        key: `p-${c.id}`,
        kind: "prova",
        data: c.prova.data,
        hora: c.prova.hora,
        fim: "",
        titulo: `Prova ${nome}`,
        detalhe: [c.prova.modalidade === "online" ? "Online" : c.prova.modalidade === "presencial" ? "Presencial" : "", c.prova.local].filter(Boolean).join(" · "),
        href,
      });
    }
    if (c.prova.voucherValidade && dentro(c.prova.voucherValidade) && c.status !== "aprovada") {
      out.push({ key: `v-${c.id}`, kind: "voucher", data: c.prova.voucherValidade, hora: "", fim: "", titulo: `Voucher ${nome} vence`, detalhe: "Agende a prova antes", href });
    }
    if (c.expiraEm && dentro(c.expiraEm)) {
      out.push({ key: `x-${c.id}`, kind: "validade", data: c.expiraEm, hora: "", fim: "", titulo: `${nome} vence`, detalhe: "Planeje a renovação", href });
    }
  }

  for (const s of src.sessoes) {
    const d = s.inicio.slice(0, 10);
    if (!dentro(d)) continue;
    const hora = s.inicio.slice(11, 16);
    out.push({
      key: `s-${s.id}`,
      kind: "sessao",
      data: d,
      hora,
      fim: somaHora(hora, s.minutos),
      titulo: s.alvo.nome,
      detalhe: "",
      sessao: s,
      minutos: s.minutos,
    });
  }

  return out.sort((a, b) => a.data.localeCompare(b.data) || (a.hora || "").localeCompare(b.hora || "") || a.titulo.localeCompare(b.titulo));
}
