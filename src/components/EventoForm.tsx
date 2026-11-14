import { useState, type FormEvent } from "react";
import { DIAS_CURTOS, diaSemana, validateEvento, type Evento, type EventoInput, type EventoTipo, type Recorrente } from "../data/agenda";
import { todayStr } from "../data/dates";
import { fmtDuracao } from "../data/sessoes";
import { AlvoSelect, alvoKey, useAlvos } from "./AlvoSelect";
import { Icon } from "./Icon";

export function EventoForm({
  evento,
  recorrente,
  dataPadrao,
  horaPadrao,
  busy,
  onSave,
  onCancel,
  onDelete,
}: {
  evento?: Evento;
  recorrente?: Recorrente;
  dataPadrao?: string;
  horaPadrao?: string;
  busy: boolean;
  onSave: (input: EventoInput) => void;
  onCancel: () => void;
  onDelete?: () => void;
}) {
  const { fromKey } = useAlvos();
  const base = evento ?? recorrente;
  const [tipo, setTipo] = useState<EventoTipo>(evento?.tipo ?? "bloco");
  const [alvoK, setAlvoK] = useState(base ? alvoKey(base.alvo) : "livre");
  const [titulo, setTitulo] = useState(base?.titulo ?? "");
  const [tituloTocado, setTituloTocado] = useState(!!base);
  const [data, setData] = useState(evento?.data ?? recorrente?.desde ?? dataPadrao ?? todayStr());
  const [diaInteiro, setDiaInteiro] = useState(evento ? !evento.hora : false);
  const [hora, setHora] = useState(evento?.hora || recorrente?.hora || horaPadrao || "20:00");
  const [dur, setDur] = useState(base?.duracaoMin || 60);
  const [repetir, setRepetir] = useState(!!recorrente);
  const [dias, setDias] = useState<number[]>(recorrente?.dias ?? [diaSemana(dataPadrao ?? todayStr())]);
  const [ate, setAte] = useState(recorrente?.ate ?? "");
  const [nota, setNota] = useState(base?.nota ?? "");
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});

  const alvoAtual = base && alvoK === alvoKey(base.alvo) ? base.alvo : fromKey(alvoK);

  const changeAlvo = (k: string) => {
    setAlvoK(k);
    if (!tituloTocado) {
      const a = fromKey(k);
      setTitulo(a.tipo === "livre" ? "" : a.nome);
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const bloco = tipo === "bloco";
    const r = validateEvento({
      tipo,
      titulo: titulo || (bloco ? (alvoAtual.tipo !== "livre" ? alvoAtual.nome : "Estudo") : ""),
      data,
      hora: bloco || !diaInteiro ? hora : "",
      duracaoMin: bloco ? dur : 0,
      alvo: alvoAtual,
      nota,
      repetir: bloco && repetir,
      dias,
      ate,
    });
    setErrors(r.errors);
    if (r.value) onSave(r.value);
  };

  const toggleDia = (d: number) => setDias((x) => (x.includes(d) ? x.filter((y) => y !== d) : [...x, d]));

  return (
    <form className="form" onSubmit={submit} noValidate>
      {!base && (
        <div className="segmented" role="radiogroup" aria-label="Tipo de evento">
          {(
            [
              ["bloco", "Bloco de estudo"],
              ["prazo", "Prazo"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={tipo === k}
              className={tipo === k ? "active" : ""}
              onClick={() => setTipo(k)}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      <div className="field">
        <label htmlFor="evt-alvo">{tipo === "bloco" ? "O que vai estudar?" : "Relacionado a"}</label>
        <AlvoSelect id="evt-alvo" value={alvoK} onChange={changeAlvo} current={base?.alvo} />
      </div>

      <div className="field">
        <label htmlFor="evt-titulo">Título</label>
        <input
          id="evt-titulo"
          className="input"
          value={titulo}
          onChange={(e) => {
            setTitulo(e.target.value);
            setTituloTocado(true);
          }}
          maxLength={120}
          placeholder={tipo === "bloco" ? "Ex.: Revisar módulo 3" : "Ex.: Entregar lab de VPC"}
          aria-invalid={errors.titulo ? true : undefined}
        />
        {errors.titulo && <p className="field-error">{errors.titulo}</p>}
      </div>

      {tipo === "bloco" && (
        <label className="check-row">
          <input type="checkbox" checked={repetir} onChange={(e) => setRepetir(e.target.checked)} />
          <span>Repetir toda semana</span>
        </label>
      )}

      {tipo === "bloco" && repetir && (
        <fieldset className="field">
          <legend>Dias da semana</legend>
          <div className="weekday-picker">
            {DIAS_CURTOS.map((label, i) => (
              <button
                key={label}
                type="button"
                className={`weekday${dias.includes(i) ? " active" : ""}`}
                aria-pressed={dias.includes(i)}
                onClick={() => toggleDia(i)}
              >
                {label}
              </button>
            ))}
          </div>
          {errors.dias && <p className="field-error">{errors.dias}</p>}
        </fieldset>
      )}

      <div className="form-row">
        <div className="field">
          <label htmlFor="evt-data">{tipo === "bloco" && repetir ? "A partir de" : "Data"}</label>
          <input id="evt-data" className="input" type="date" value={data} onChange={(e) => setData(e.target.value)} />
          {errors.data && <p className="field-error">{errors.data}</p>}
        </div>
        {tipo === "bloco" && repetir ? (
          <div className="field">
            <label htmlFor="evt-ate">
              Até <span className="muted">(opcional)</span>
            </label>
            <input id="evt-ate" className="input" type="date" value={ate} onChange={(e) => setAte(e.target.value)} />
            {errors.ate && <p className="field-error">{errors.ate}</p>}
          </div>
        ) : (
          (tipo === "bloco" || !diaInteiro) && (
            <div className="field">
              <label htmlFor="evt-hora">{tipo === "bloco" ? "Começa às" : "Horário"}</label>
              <input id="evt-hora" className="input" type="time" value={hora} onChange={(e) => setHora(e.target.value)} />
              {errors.hora && <p className="field-error">{errors.hora}</p>}
            </div>
          )
        )}
      </div>

      {tipo === "bloco" && repetir && (
        <div className="field">
          <label htmlFor="evt-hora-r">Começa às</label>
          <input id="evt-hora-r" className="input" type="time" value={hora} onChange={(e) => setHora(e.target.value)} />
          {errors.hora && <p className="field-error">{errors.hora}</p>}
        </div>
      )}

      {tipo === "prazo" && (
        <label className="check-row">
          <input type="checkbox" checked={diaInteiro} onChange={(e) => setDiaInteiro(e.target.checked)} />
          <span>Dia inteiro (sem horário)</span>
        </label>
      )}

      {tipo === "bloco" && (
        <fieldset className="field">
          <legend>Duração</legend>
          <div className="quick-fill">
            {[30, 45, 60, 90, 120].map((m) => (
              <button
                key={m}
                type="button"
                className={`chip${dur === m ? " active" : ""}`}
                aria-pressed={dur === m}
                onClick={() => setDur(m)}
              >
                {fmtDuracao(m)}
              </button>
            ))}
            <div className="input-suffix dur-custom">
              <input
                className="input input-sm"
                type="number"
                min={5}
                max={720}
                value={dur}
                onChange={(e) => setDur(Number(e.target.value))}
                aria-label="Duração em minutos"
              />
              <span aria-hidden="true">min</span>
            </div>
          </div>
          {errors.duracaoMin && <p className="field-error">{errors.duracaoMin}</p>}
        </fieldset>
      )}

      <div className="field">
        <label htmlFor="evt-nota">
          Observação <span className="muted">(opcional)</span>
        </label>
        <input id="evt-nota" className="input" value={nota} onChange={(e) => setNota(e.target.value)} maxLength={300} />
        {errors.nota && <p className="field-error">{errors.nota}</p>}
      </div>

      <div className="dialog-actions dialog-actions-split">
        {onDelete ? (
          <button type="button" className="btn btn-quiet text-red" onClick={onDelete} disabled={busy}>
            <Icon name="trash" size={16} />
            {recorrente ? "Apagar repetição" : "Apagar"}
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
