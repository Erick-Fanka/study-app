// Tabela colorida de simulados (domínios × datas) e formulário de simulado.

import { useState, type FormEvent } from "react";
import type { Dominio } from "../data/certs";
import {
  faixa,
  pctDominio,
  pctGeral,
  validateSimulado,
  type ModoNota,
  type NotaDominio,
  type Simulado,
  type SimuladoInput,
} from "../data/simulados";
import { fmtShort, todayStr } from "../data/dates";
import { toNum } from "./CertForms";
import { Icon } from "./Icon";

function Cell({ pct, avg }: { pct: number | null; avg?: boolean }) {
  const f = faixa(pct);
  const cls = `sim-cell ${f ? `sim-${f}` : "sim-vazio"}${avg ? " sim-avg" : ""}`;
  return <td className={cls}>{pct === null ? "—" : `${pct}%`}</td>;
}

function media(values: (number | null)[]): number | null {
  const v = values.filter((x): x is number => x !== null);
  return v.length ? Math.round(v.reduce((s, x) => s + x, 0) / v.length) : null;
}

export function SimuladosTable({
  dominios,
  simulados,
  onEdit,
}: {
  dominios: Dominio[];
  simulados: Simulado[];
  onEdit: (s: Simulado) => void;
}) {
  const ultimos = simulados.slice(-3);
  const temGeral = simulados.some((s) => pctGeral(s) !== null);

  return (
    <>
      <div className="sim-table-wrap" tabIndex={0} aria-label="Tabela de simulados (role para os lados)">
        <table className="sim-table">
          <thead>
            <tr>
              <th scope="col" className="sim-sticky">
                Domínio
              </th>
              {simulados.map((s, i) => (
                <th scope="col" key={s.id}>
                  <button
                    type="button"
                    className="sim-head-btn"
                    onClick={() => onEdit(s)}
                    title={`${s.fonte || `Simulado ${i + 1}`} — clique para editar`}
                  >
                    <span>{fmtShort(s.data)}</span>
                    <small>{s.fonte ? s.fonte : `#${i + 1}`}</small>
                  </button>
                </th>
              ))}
              {simulados.length > 1 && (
                <th scope="col" className="sim-avg-col">
                  Média
                  <small>últimos {ultimos.length}</small>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {dominios.map((d) => (
              <tr key={d.id}>
                <th scope="row" className="sim-sticky">
                  <span className="sim-dom">{d.nome}</span>
                  {d.peso > 0 && <small className="muted">{d.peso}% da prova</small>}
                </th>
                {simulados.map((s) => (
                  <Cell key={s.id} pct={pctDominio(s, d.id)} />
                ))}
                {simulados.length > 1 && <Cell avg pct={media(ultimos.map((s) => pctDominio(s, d.id)))} />}
              </tr>
            ))}
            {temGeral && (
              <tr className="sim-geral">
                <th scope="row" className="sim-sticky">
                  <span className="sim-dom">Geral</span>
                </th>
                {simulados.map((s) => (
                  <Cell key={s.id} pct={pctGeral(s)} />
                ))}
                {simulados.length > 1 && <Cell avg pct={media(ultimos.map(pctGeral))} />}
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="sim-legend" aria-label="Legenda">
        <span>
          <i className="sim-baixa" /> abaixo de 70%
        </span>
        <span>
          <i className="sim-media" /> 70% a 79%
        </span>
        <span>
          <i className="sim-alta" /> 80% ou mais
        </span>
        <span className="muted">Clique na data para editar ou apagar.</span>
      </div>
    </>
  );
}

const str = (n: number | null) => (n === null ? "" : String(n));

export function SimuladoForm({
  initial,
  dominios,
  fontes,
  busy,
  onSave,
  onCancel,
  onDelete,
}: {
  initial: SimuladoInput | null;
  dominios: Dominio[];
  fontes: string[];
  busy: boolean;
  onSave: (input: SimuladoInput) => void;
  onCancel: () => void;
  onDelete?: () => void;
}) {
  const [data, setData] = useState(initial?.data ?? todayStr());
  const [fonte, setFonte] = useState(initial?.fonte ?? fontes[fontes.length - 1] ?? "");
  const [modo, setModo] = useState<ModoNota>(initial?.modo ?? "pct");
  const [geral, setGeral] = useState(str(initial?.geral ?? null));
  const [vals, setVals] = useState<Record<string, { pct: string; acertos: string; total: string }>>(() => {
    const out: Record<string, { pct: string; acertos: string; total: string }> = {};
    for (const d of dominios) {
      const n = initial?.notas.find((x) => x.dominioId === d.id);
      out[d.id] = { pct: str(n?.pct ?? null), acertos: str(n?.acertos ?? null), total: str(n?.total ?? null) };
    }
    return out;
  });
  const [errors, setErrors] = useState<Partial<Record<"data" | "fonte" | "geral" | "notas", string>>>({});

  const setVal = (id: string, k: "pct" | "acertos" | "total", v: string) =>
    setVals((x) => ({ ...x, [id]: { ...x[id], [k]: v } }));

  const notas: NotaDominio[] = dominios.map((d) => ({
    dominioId: d.id,
    pct: toNum(vals[d.id]?.pct ?? ""),
    acertos: toNum(vals[d.id]?.acertos ?? ""),
    total: toNum(vals[d.id]?.total ?? ""),
  }));

  const preview = pctGeral({ id: "", certId: "", data, fonte, modo, geral: toNum(geral), notas, criadoEm: "" });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const g = toNum(geral);
    const r = validateSimulado({ data, fonte, modo, geral: Number.isNaN(g) ? -1 : g, notas }, dominios);
    setErrors(r.errors);
    if (r.value) onSave(r.value);
  };

  return (
    <form className="form" onSubmit={submit} noValidate>
      <div className="form-row">
        <div className="field">
          <label htmlFor="sim-data">Data</label>
          <input id="sim-data" className="input" type="date" value={data} onChange={(e) => setData(e.target.value)} />
          {errors.data && <p className="field-error">{errors.data}</p>}
        </div>
        <div className="field">
          <label htmlFor="sim-fonte">
            Fonte <span className="muted">(opcional)</span>
          </label>
          <input
            id="sim-fonte"
            className="input"
            list="sim-fontes"
            value={fonte}
            onChange={(e) => setFonte(e.target.value)}
            maxLength={120}
            placeholder="Ex.: Udemy – Simulado 3"
          />
          <datalist id="sim-fontes">
            {[...new Set(fontes)].map((x) => (
              <option key={x} value={x} />
            ))}
          </datalist>
          {errors.fonte && <p className="field-error">{errors.fonte}</p>}
        </div>
      </div>

      <div className="field">
        <span className="field-label">Como registrar a nota</span>
        <div className="segmented" role="radiogroup" aria-label="Modo da nota">
          {(
            [
              ["pct", "Porcentagem"],
              ["acertos", "Acertos / total"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={modo === k}
              className={modo === k ? "active" : ""}
              onClick={() => setModo(k)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {dominios.length === 0 ? (
        <p className="muted small">
          Esta certificação ainda não tem domínios. Você pode registrar só a nota geral, ou adicionar os domínios em
          “Editar”.
        </p>
      ) : (
        <div className="sim-inputs">
          {dominios.map((d) => (
            <div key={d.id} className="sim-input-row">
              <label htmlFor={`sim-${d.id}`} className="sim-input-label">
                {d.nome}
              </label>
              {modo === "pct" ? (
                <div className="input-suffix">
                  <input
                    id={`sim-${d.id}`}
                    className="input"
                    inputMode="numeric"
                    value={vals[d.id]?.pct ?? ""}
                    onChange={(e) => setVal(d.id, "pct", e.target.value)}
                    placeholder="—"
                  />
                  <span aria-hidden="true">%</span>
                </div>
              ) : (
                <div className="acertos">
                  <input
                    id={`sim-${d.id}`}
                    className="input"
                    inputMode="numeric"
                    value={vals[d.id]?.acertos ?? ""}
                    onChange={(e) => setVal(d.id, "acertos", e.target.value)}
                    placeholder="acertos"
                    aria-label={`Acertos em ${d.nome}`}
                  />
                  <span aria-hidden="true">/</span>
                  <input
                    className="input"
                    inputMode="numeric"
                    value={vals[d.id]?.total ?? ""}
                    onChange={(e) => setVal(d.id, "total", e.target.value)}
                    placeholder="total"
                    aria-label={`Total de questões em ${d.nome}`}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {errors.notas && <p className="field-error">{errors.notas}</p>}

      <div className="sim-input-row sim-geral-row">
        <label htmlFor="sim-geral" className="sim-input-label">
          <strong>Nota geral</strong>
        </label>
        {modo === "pct" ? (
          <div className="input-suffix">
            <input
              id="sim-geral"
              className="input"
              inputMode="numeric"
              value={geral}
              onChange={(e) => setGeral(e.target.value)}
              placeholder="—"
            />
            <span aria-hidden="true">%</span>
          </div>
        ) : (
          <span className="sim-geral-calc">{preview === null ? "—" : `${preview}%`} (calculada)</span>
        )}
      </div>
      {errors.geral && <p className="field-error">{errors.geral}</p>}

      <div className="dialog-actions dialog-actions-split">
        {onDelete ? (
          <button type="button" className="btn btn-quiet text-red" onClick={onDelete} disabled={busy}>
            <Icon name="trash" size={16} />
            Apagar
          </button>
        ) : (
          <span />
        )}
        <span className="dialog-actions">
          <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={busy}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? "Salvando…" : "Salvar"}
          </button>
        </span>
      </div>
    </form>
  );
}
