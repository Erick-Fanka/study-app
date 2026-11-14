// Gráfico de evolução dos simulados: uma linha por domínio (cores categóricas
// validadas para daltonismo) + "Geral" neutra e tracejada. Faixas de fundo
// marcam < 70, 70–79 e ≥ 80. Passe o mouse (ou use ← →) para ver os valores.

import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent, type RefObject } from "react";
import type { Dominio } from "../data/certs";
import { pctDominio, pctGeral, type Simulado } from "../data/simulados";
import { fmtShort } from "../data/dates";

interface Serie {
  key: string;
  name: string;
  color: string;
  dashed: boolean;
  values: (number | null)[];
}

const HEIGHT = 300;
const SLOTS = 8;

function useWidth<T extends HTMLElement>(): [RefObject<T | null>, number] {
  const ref = useRef<T>(null);
  const [w, setW] = useState(720);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(280, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

/** Divide a série em trechos contínuos (um valor ausente quebra a linha). */
function segments(values: (number | null)[]): [number, number][][] {
  const out: [number, number][][] = [];
  let cur: [number, number][] = [];
  values.forEach((v, i) => {
    if (v === null) {
      if (cur.length) out.push(cur);
      cur = [];
    } else cur.push([i, v]);
  });
  if (cur.length) out.push(cur);
  return out;
}

export function EvolucaoChart({ dominios, simulados }: { dominios: Dominio[]; simulados: Simulado[] }) {
  const [wrapRef, width] = useWidth<HTMLDivElement>();
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [active, setActive] = useState<number | null>(null);

  const series: Serie[] = useMemo(() => {
    const list: Serie[] = dominios.map((d, k) => ({
      key: d.id,
      name: d.nome,
      color: `var(--series-${(k % SLOTS) + 1})`,
      dashed: false,
      values: simulados.map((s) => pctDominio(s, d.id)),
    }));
    const geral = simulados.map(pctGeral);
    if (geral.some((v) => v !== null)) {
      list.push({ key: "geral", name: "Geral", color: "var(--series-neutral)", dashed: true, values: geral });
    }
    return list;
  }, [dominios, simulados]);

  const n = simulados.length;
  const wide = width >= 620;
  const pad = { top: 14, right: wide ? 178 : 14, bottom: 36, left: 40 };
  const plotW = width - pad.left - pad.right;
  const plotH = HEIGHT - pad.top - pad.bottom;
  const x = (i: number) => pad.left + (n <= 1 ? plotW / 2 : (i * plotW) / (n - 1));
  const y = (v: number) => pad.top + (1 - v / 100) * plotH;

  const visible = series.filter((s) => !hidden.has(s.key));

  // Rótulos de data: espaça para não colidir (~56px por rótulo).
  const step = Math.max(1, Math.ceil(n / Math.max(1, Math.floor(plotW / 56))));

  // Rótulos diretos no fim de cada linha (só em telas largas e até 4 séries), afastados para não sobrepor.
  const endLabels = useMemo(() => {
    if (!wide || visible.length > 5) return [];
    const items = visible
      .map((s) => {
        let last = -1;
        s.values.forEach((v, i) => v !== null && (last = i));
        return last < 0 ? null : { s, i: last, y: y(s.values[last] as number) };
      })
      .filter((v): v is { s: Serie; i: number; y: number } => v !== null)
      .sort((a, b) => a.y - b.y);
    for (let k = 1; k < items.length; k++) {
      if (items[k].y - items[k - 1].y < 15) items[k].y = items[k - 1].y + 15;
    }
    return items;
  }, [visible, wide, width]);

  if (n === 0) return null;

  const toggle = (key: string) =>
    setHidden((h) => {
      const next = new Set(h);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const onMove = (e: PointerEvent<SVGRectElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * plotW;
    const i = n <= 1 ? 0 : Math.round((px / plotW) * (n - 1));
    setActive(Math.max(0, Math.min(n - 1, i)));
  };

  const onKey = (e: KeyboardEvent<SVGSVGElement>) => {
    if (e.key === "ArrowRight") setActive((a) => Math.min(n - 1, (a ?? -1) + 1));
    else if (e.key === "ArrowLeft") setActive((a) => Math.max(0, (a ?? n) - 1));
    else if (e.key === "Escape") setActive(null);
    else return;
    e.preventDefault();
  };

  const tipLeft = active === null ? 0 : Math.min(Math.max(x(active) + 12, 8), width - 220);
  const tipFlip = active !== null && x(active) + 232 > width;

  return (
    <div className="viz">
      <div className="viz-legend" role="group" aria-label="Séries do gráfico (clique para mostrar ou ocultar)">
        {series.map((s) => (
          <button
            key={s.key}
            type="button"
            className={`viz-legend-item${hidden.has(s.key) ? " off" : ""}`}
            aria-pressed={!hidden.has(s.key)}
            onClick={() => toggle(s.key)}
          >
            <svg width="22" height="10" aria-hidden="true">
              <line
                x1="1"
                y1="5"
                x2="21"
                y2="5"
                style={{ stroke: s.color }}
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeDasharray={s.dashed ? "4 3" : undefined}
              />
              {!s.dashed && <circle cx="11" cy="5" r="3.5" style={{ fill: s.color }} />}
            </svg>
            {s.name}
          </button>
        ))}
      </div>

      <div className="viz-plot" ref={wrapRef}>
        <svg
          width={width}
          height={HEIGHT}
          viewBox={`0 0 ${width} ${HEIGHT}`}
          role="img"
          aria-label={`Evolução de ${n} simulados por domínio, de ${fmtShort(simulados[0].data)} a ${fmtShort(simulados[n - 1].data)}. Use as setas para percorrer os valores.`}
          tabIndex={0}
          onKeyDown={onKey}
          onBlur={() => setActive(null)}
        >
          {/* Faixas de desempenho */}
          <rect className="viz-band viz-band-alta" x={pad.left} y={y(100)} width={plotW} height={y(80) - y(100)} />
          <rect className="viz-band viz-band-media" x={pad.left} y={y(80)} width={plotW} height={y(70) - y(80)} />
          <rect className="viz-band viz-band-baixa" x={pad.left} y={y(70)} width={plotW} height={y(0) - y(70)} />

          {/* Grade e eixo Y */}
          {[0, 25, 50, 75, 100].map((v) => (
            <g key={v}>
              <line className="viz-grid" x1={pad.left} x2={pad.left + plotW} y1={y(v)} y2={y(v)} />
              <text className="viz-tick" x={pad.left - 8} y={y(v)} dy="0.32em" textAnchor="end">
                {v}%
              </text>
            </g>
          ))}
          {[70, 80].map((v) => (
            <g key={v}>
              <line className="viz-ref" x1={pad.left} x2={pad.left + plotW} y1={y(v)} y2={y(v)} />
              <text className="viz-ref-label" x={pad.left + plotW - 4} y={y(v) - 4} textAnchor="end">
                {v}%
              </text>
            </g>
          ))}

          {/* Eixo X: datas */}
          {simulados.map((s, i) =>
            i % step === 0 || i === n - 1 ? (
              <text key={s.id} className="viz-tick" x={x(i)} y={HEIGHT - pad.bottom + 20} textAnchor="middle">
                {fmtShort(s.data)}
              </text>
            ) : null,
          )}

          {/* Linha de foco */}
          {active !== null && (
            <line className="viz-crosshair" x1={x(active)} x2={x(active)} y1={pad.top} y2={pad.top + plotH} />
          )}

          {/* Séries */}
          {visible.map((s) => (
            <g key={s.key}>
              {segments(s.values).map((seg, k) =>
                seg.length > 1 ? (
                  <polyline
                    key={k}
                    className="viz-line"
                    points={seg.map(([i, v]) => `${x(i)},${y(v)}`).join(" ")}
                    style={{ stroke: s.color }}
                    strokeDasharray={s.dashed ? "6 4" : undefined}
                  />
                ) : null,
              )}
              {s.values.map((v, i) =>
                v === null ? null : (
                  <circle
                    key={i}
                    className="viz-dot"
                    cx={x(i)}
                    cy={y(v)}
                    r={active === i ? 5.5 : s.dashed ? 3 : 4}
                    style={{ fill: s.color }}
                  />
                ),
              )}
            </g>
          ))}

          {/* Rótulos diretos */}
          {endLabels.map(({ s, i, y: ly }) => (
            <text key={s.key} className="viz-end-label" x={x(i) + 10} y={ly} dy="0.32em">
              {s.name.length > 22 ? `${s.name.slice(0, 21)}…` : s.name} {s.values[i]}%
            </text>
          ))}

          {/* Área de captura do ponteiro (maior que as marcas) */}
          <rect
            x={pad.left - 10}
            y={pad.top}
            width={plotW + 20}
            height={plotH}
            fill="transparent"
            onPointerMove={onMove}
            onPointerDown={onMove}
            onPointerLeave={() => setActive(null)}
          />
        </svg>

        {active !== null && (
          <div
            className="viz-tip"
            style={{ left: tipFlip ? Math.max(8, x(active) - 232) : tipLeft, top: pad.top }}
            role="status"
          >
            <strong>{fmtShort(simulados[active].data)}</strong>
            {simulados[active].fonte && <small>{simulados[active].fonte}</small>}
            <ul>
              {visible.map((s) => (
                <li key={s.key}>
                  <span className="viz-tip-swatch" style={{ background: s.color }} aria-hidden="true" />
                  <span className="viz-tip-name">{s.name}</span>
                  <b>{s.values[active] === null ? "—" : `${s.values[active]}%`}</b>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
