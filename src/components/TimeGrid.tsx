// Grade de horários (visões Semana e Dia): eventos posicionados pela hora e
// duração; itens sem horário ficam na faixa "Dia todo". Clicar num horário
// vazio cria um evento naquele dia e hora.

import { useEffect, useRef, type MouseEvent } from "react";
import { KIND, type AgendaItem } from "../data/agenda";
import { parseDate, todayStr } from "../data/dates";
import { fmtDuracao } from "../data/sessoes";

const H0 = 6; // primeira hora exibida
const H1 = 24; // última
const PX = 48; // altura de 1 hora

const toMin = (h: string) => Number(h.slice(0, 2)) * 60 + Number(h.slice(3, 5));

interface Placed {
  it: AgendaItem;
  top: number;
  height: number;
  lane: number;
  lanes: number;
}

/** Distribui itens que se sobrepõem em colunas lado a lado. */
function layout(items: AgendaItem[]): Placed[] {
  const timed = items
    .filter((i) => i.hora)
    .map((it) => {
      const ini = toMin(it.hora);
      const fim = it.fim ? Math.max(toMin(it.fim), ini + 15) : ini + 60;
      return { it, ini, fim };
    })
    .sort((a, b) => a.ini - b.ini || b.fim - a.fim);

  const out: Placed[] = [];
  let grupo: { it: AgendaItem; ini: number; fim: number; lane: number }[] = [];
  let grupoFim = -1;
  const fechar = () => {
    const lanes = Math.max(1, ...grupo.map((g) => g.lane + 1));
    for (const g of grupo) {
      const top = Math.max(0, ((g.ini - H0 * 60) / 60) * PX);
      const bottom = Math.max(top + 18, ((g.fim - H0 * 60) / 60) * PX);
      out.push({ it: g.it, top, height: bottom - top, lane: g.lane, lanes });
    }
    grupo = [];
  };
  for (const t of timed) {
    if (grupo.length && t.ini >= grupoFim) fechar();
    const ocupadas = new Set(grupo.filter((g) => g.fim > t.ini).map((g) => g.lane));
    let lane = 0;
    while (ocupadas.has(lane)) lane++;
    grupo.push({ ...t, lane });
    grupoFim = Math.max(grupoFim, t.fim);
  }
  if (grupo.length) fechar();
  return out;
}

export function TimeGrid({
  dias,
  porDia,
  onOpen,
  onNewAt,
}: {
  dias: string[];
  porDia: Map<string, AgendaItem[]>;
  onOpen: (it: AgendaItem) => void;
  onNewAt: (data: string, hora: string) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const hoje = todayStr();
  const agora = new Date();
  const agoraMin = agora.getHours() * 60 + agora.getMinutes();

  // Ao abrir, rola até perto da hora atual (ou 7h).
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const alvo = dias.includes(hoje) ? Math.max(H0, agora.getHours() - 1) : 7;
    el.scrollTop = (alvo - H0) * PX;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dias.join(",")]);

  const horas = Array.from({ length: H1 - H0 }, (_, i) => H0 + i);
  const temDiaTodo = dias.some((d) => (porDia.get(d) ?? []).some((i) => !i.hora));

  const clickCol = (d: string) => (e: MouseEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return;
    const y = e.nativeEvent.offsetY;
    const h = Math.min(H1 - 1, H0 + Math.floor(y / PX));
    onNewAt(d, `${String(h).padStart(2, "0")}:00`);
  };

  return (
    <div className={`tg${dias.length === 1 ? " tg-day" : ""}`} style={{ ["--tg-cols" as string]: dias.length }}>
      <div className="tg-head">
        <span />
        {dias.map((d) => {
          const dt = parseDate(d);
          return (
            <span key={d} className={`tg-dayhead${d === hoje ? " today" : ""}`}>
              <small>{dt.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "")}</small>
              <b>{dt.getDate()}</b>
            </span>
          );
        })}
      </div>

      {temDiaTodo && (
        <div className="tg-allday">
          <span className="tg-allday-label">Dia todo</span>
          {dias.map((d) => (
            <div key={d} className="tg-allday-cell">
              {(porDia.get(d) ?? [])
                .filter((i) => !i.hora)
                .map((it) => (
                  <button
                    key={it.key}
                    type="button"
                    className={`tg-chip tone-${KIND[it.kind].tone}${it.concluido ? " done" : ""}`}
                    onClick={() => onOpen(it)}
                    title={it.titulo}
                  >
                    {it.titulo}
                  </button>
                ))}
            </div>
          ))}
        </div>
      )}

      <div className="tg-scroll" ref={scrollRef}>
        <div className="tg-body" style={{ height: (H1 - H0) * PX }}>
          <div className="tg-hours">
            {horas.map((h) => (
              <span key={h} style={{ top: (h - H0) * PX }}>
                {String(h).padStart(2, "0")}:00
              </span>
            ))}
          </div>
          {dias.map((d) => (
            <div
              key={d}
              className={`tg-col${d === hoje ? " today" : ""}`}
              onClick={clickCol(d)}
              title="Clique num horário vazio para criar um evento"
            >
              {layout(porDia.get(d) ?? []).map((p) => {
                const k = KIND[p.it.kind];
                return (
                  <button
                    key={p.it.key}
                    type="button"
                    className={`tg-event tone-${k.tone}${p.it.concluido ? " done" : ""}${p.it.kind === "sessao" ? " sessao" : ""}`}
                    style={{
                      top: p.top,
                      height: p.height,
                      left: `calc(${(p.lane / p.lanes) * 100}% + 2px)`,
                      width: `calc(${100 / p.lanes}% - 4px)`,
                    }}
                    onClick={() => onOpen(p.it)}
                    title={`${p.it.hora}${p.it.fim ? `–${p.it.fim}` : ""} ${p.it.titulo}`}
                  >
                    <b>{p.it.titulo}</b>
                    {p.height >= 34 && (
                      <small>
                        {p.it.hora}
                        {p.it.fim && `–${p.it.fim}`}
                        {p.it.minutos ? ` · ${fmtDuracao(p.it.minutos)}` : ""}
                      </small>
                    )}
                  </button>
                );
              })}
              {d === hoje && agoraMin >= H0 * 60 && (
                <span className="tg-now" style={{ top: ((agoraMin - H0 * 60) / 60) * PX }} aria-hidden="true" />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
