// Cálculos do painel: sequência de dias, horas por área e por semana, avisos.

import type { Area } from "./areas";
import type { Cert } from "./certs";
import type { Evento } from "./agenda";
import { addDays, inicioSemana, type Sessao } from "./sessoes";
import { daysUntil, fmtShort, relDays, toDateStr, todayStr } from "./dates";

export interface Sequencia {
  atual: number;
  estudouHoje: boolean;
  recorde: number;
  limite: boolean; // chegou ao fim do período consultado (pode ser maior)
}

/** Dias seguidos com estudo. Se ainda não estudou hoje, a sequência continua viva até o fim do dia. */
export function sequencia(sessoes: Sessao[], diasConsultados: number): Sequencia {
  const dias = new Set(sessoes.filter((s) => s.minutos > 0).map((s) => s.inicio.slice(0, 10)));
  const hoje = todayStr();
  const estudouHoje = dias.has(hoje);
  let d = estudouHoje ? new Date() : addDays(new Date(), -1);
  let atual = 0;
  while (dias.has(toDateStr(d))) {
    atual++;
    d = addDays(d, -1);
  }
  let recorde = 0;
  let run = 0;
  for (let i = diasConsultados - 1; i >= 0; i--) {
    if (dias.has(toDateStr(addDays(new Date(), -i)))) recorde = Math.max(recorde, ++run);
    else run = 0;
  }
  return { atual, estudouHoje, recorde: Math.max(recorde, atual), limite: atual >= diasConsultados };
}

export interface HorasArea {
  areaId: string;
  nome: string;
  cor: string;
  minutos: number;
}

export function horasPorArea(sessoes: Sessao[], areas: Area[], desde: string): HorasArea[] {
  const map = new Map<string, number>();
  for (const s of sessoes) {
    if (s.inicio.slice(0, 10) < desde) continue;
    const id = areas.some((a) => a.id === s.alvo.areaId) ? s.alvo.areaId : "";
    map.set(id, (map.get(id) ?? 0) + s.minutos);
  }
  return [...map.entries()]
    .map(([areaId, minutos]) => {
      const a = areas.find((x) => x.id === areaId);
      return { areaId, nome: a?.nome ?? "Sem área", cor: a?.cor ?? "ink", minutos };
    })
    .sort((a, b) => b.minutos - a.minutos);
}

export interface Semana {
  inicio: string;
  label: string;
  minutos: number;
  atual: boolean;
}

export function porSemana(sessoes: Sessao[], n: number): Semana[] {
  const seg = inicioSemana();
  return Array.from({ length: n }, (_, k) => {
    const ini = addDays(seg, -7 * (n - 1 - k));
    const de = toDateStr(ini);
    const ate = toDateStr(addDays(ini, 6));
    const minutos = sessoes
      .filter((s) => {
        const d = s.inicio.slice(0, 10);
        return d >= de && d <= ate;
      })
      .reduce((t, s) => t + s.minutos, 0);
    return { inicio: de, label: fmtShort(de), minutos, atual: k === n - 1 };
  });
}

export type NivelAviso = "critico" | "atencao" | "info";

export interface Aviso {
  key: string;
  nivel: NivelAviso;
  titulo: string;
  detalhe: string;
  href: string;
  dias: number;
}

/** Avisos de prazos: atrasados, provas próximas, voucher e validade vencendo. */
export function avisos(eventos: Evento[], certs: Cert[]): Aviso[] {
  const out: Aviso[] = [];
  const hoje = todayStr();

  for (const e of eventos) {
    if (e.tipo !== "prazo" || e.concluido) continue;
    const dias = daysUntil(e.data);
    if (e.data < hoje) {
      out.push({ key: `e-${e.id}`, nivel: "critico", titulo: e.titulo, detalhe: `Prazo atrasado (${fmtShort(e.data)})`, href: "/agenda", dias });
    } else if (dias <= 3) {
      out.push({ key: `e-${e.id}`, nivel: "atencao", titulo: e.titulo, detalhe: `Prazo ${relDays(dias)}`, href: "/agenda", dias });
    }
  }

  for (const c of certs) {
    const nome = c.codigo || c.nome;
    const href = `/certificacoes/${c.id}`;
    if (c.status !== "aprovada" && c.prova.data) {
      const dias = daysUntil(c.prova.data);
      if (dias >= 0 && dias <= 14)
        out.push({ key: `p-${c.id}`, nivel: dias <= 3 ? "critico" : "atencao", titulo: `Prova ${nome}`, detalhe: `${relDays(dias)}${c.prova.hora ? ` às ${c.prova.hora}` : ""}`, href, dias });
    }
    if (c.status !== "aprovada" && c.prova.voucherValidade) {
      const dias = daysUntil(c.prova.voucherValidade);
      if (dias >= 0 && dias <= 30 && (!c.prova.data || c.prova.data > c.prova.voucherValidade))
        out.push({ key: `v-${c.id}`, nivel: dias <= 7 ? "critico" : "atencao", titulo: `Voucher ${nome}`, detalhe: `vence ${relDays(dias)} e a prova ainda não está marcada antes disso`, href, dias });
    }
    if (c.expiraEm) {
      const dias = daysUntil(c.expiraEm);
      if (dias < 0) out.push({ key: `x-${c.id}`, nivel: "critico", titulo: `${nome} vencida`, detalhe: `desde ${fmtShort(c.expiraEm)}`, href, dias });
      else if (dias <= 90) out.push({ key: `x-${c.id}`, nivel: "atencao", titulo: `${nome} vence`, detalhe: `${relDays(dias)}: planeje a renovação`, href, dias });
    }
  }

  const ordem: Record<NivelAviso, number> = { critico: 0, atencao: 1, info: 2 };
  return out.sort((a, b) => ordem[a.nivel] - ordem[b.nivel] || a.dias - b.dias);
}
