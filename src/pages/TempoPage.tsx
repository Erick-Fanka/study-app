import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useServices } from "../services";
import { friendlyError } from "../data/store";
import { useTimer } from "../data/TimerContext";
import { elapsedMs, fasePomodoro, fmtRelogio, minutosEstudados, type ModoCrono } from "../data/cronometro";
import {
  addDays,
  createSessao,
  deleteSessao,
  fimDe,
  fmtDuracao,
  fmtHora,
  inicioFromDate,
  inicioSemana,
  inicioToDate,
  listSessoes,
  somaMinutos,
  updateSessao,
  validateSessao,
  type Sessao,
  type SessaoInput,
} from "../data/sessoes";
import { toDateStr, todayStr } from "../data/dates";
import { Icon, type IconName } from "../components/Icon";
import { ConfirmDialog, Dialog } from "../components/Dialog";
import { useToast } from "../components/Toast";
import { AlvoSelect, alvoKey, useAlvos } from "../components/AlvoSelect";

const PREF_KEY = "estudos.cronometro.pref";

function readPref(): { alvo: string; modo: ModoCrono; foco: number; pausa: number } {
  try {
    const p = JSON.parse(localStorage.getItem(PREF_KEY) ?? "{}");
    return {
      alvo: typeof p.alvo === "string" ? p.alvo : "livre",
      modo: p.modo === "pomodoro" ? "pomodoro" : "livre",
      foco: Number.isFinite(p.foco) ? p.foco : 25,
      pausa: Number.isFinite(p.pausa) ? p.pausa : 5,
    };
  } catch {
    return { alvo: "livre", modo: "livre", foco: 25, pausa: 5 };
  }
}

export function TempoPage() {
  const { db } = useServices();
  const timer = useTimer();
  const toast = useToast();
  const [diasHistorico, setDiasHistorico] = useState(30);
  const [sessoes, setSessoes] = useState<Sessao[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<{ mode: "create" } | { mode: "edit"; s: Sessao } | null>(null);
  const [deleting, setDeleting] = useState<Sessao | null>(null);
  const [busy, setBusy] = useState(false);

  const semana0 = inicioSemana();
  const de = toDateStr(addDays(new Date(), -(diasHistorico - 1)) < semana0 ? addDays(new Date(), -(diasHistorico - 1)) : semana0);

  useEffect(() => {
    let active = true;
    setError(null);
    listSessoes(db, de, todayStr())
      .then((l) => active && setSessoes(l))
      .catch((e) => active && setError(friendlyError(e)));
    return () => {
      active = false;
    };
  }, [db, de, timer.sessionsVersion]);

  const save = async (input: SessaoInput) => {
    setBusy(true);
    try {
      if (modal?.mode === "edit") {
        await updateSessao(db, modal.s, input);
        toast.success("Sessão atualizada.");
      } else {
        await createSessao(db, input);
        toast.success(`Sessão de ${fmtDuracao(input.minutos)} registrada.`);
      }
      setModal(null);
      timer.bumpSessions();
    } catch (e) {
      toast.error(friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  const doDelete = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      await deleteSessao(db, deleting);
      toast.success("Sessão apagada.");
      setDeleting(null);
      timer.bumpSessions();
    } catch (e) {
      toast.error(friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="stack">
      <header className="page-head page-head-row">
        <div>
          <p className="eyebrow">Constância</p>
          <h1>Tempo de estudo</h1>
          <p className="muted">Cronômetro, pomodoro e o histórico do que você estudou.</p>
        </div>
        <div className="head-actions">
          <button type="button" className="btn btn-ghost" onClick={() => setModal({ mode: "create" })}>
            <Icon name="plus" size={18} />
            Lançar sessão
          </button>
        </div>
      </header>

      <div className="tempo-grid">
        <TimerCard />
        <WeekCard sessoes={sessoes} />
      </div>

      <section className="card">
        <div className="card-head">
          <h2>Histórico</h2>
          <span className="muted small">Últimos {diasHistorico} dias</span>
        </div>
        {error && <p className="field-error">{error}</p>}
        {!error && sessoes === null && <p className="muted">Carregando…</p>}
        {sessoes && sessoes.length === 0 && (
          <p className="muted">Nenhuma sessão registrada ainda. Use o cronômetro ou “Lançar sessão”.</p>
        )}
        {sessoes && sessoes.length > 0 && (
          <History sessoes={sessoes} onEdit={(s) => setModal({ mode: "edit", s })} onDelete={setDeleting} />
        )}
        {sessoes && diasHistorico < 365 && (
          <button type="button" className="btn btn-ghost btn-sm load-more" onClick={() => setDiasHistorico((d) => d + 30)}>
            Carregar mais 30 dias
          </button>
        )}
      </section>

      <Dialog
        open={modal !== null}
        title={modal?.mode === "edit" ? "Editar sessão" : "Lançar sessão"}
        onClose={() => !busy && setModal(null)}
      >
        {modal && (
          <SessaoForm
            key={modal.mode === "edit" ? modal.s.id : "new"}
            initial={modal.mode === "edit" ? modal.s : null}
            busy={busy}
            onCancel={() => setModal(null)}
            onSave={(input) => void save(input)}
          />
        )}
      </Dialog>

      <ConfirmDialog
        open={deleting !== null}
        title="Apagar sessão?"
        message={
          <p>
            A sessão de <strong>{deleting ? fmtDuracao(deleting.minutos) : ""}</strong> em {deleting?.alvo.nome} será
            apagada.
          </p>
        }
        confirmLabel="Apagar sessão"
        busy={busy}
        onConfirm={() => void doDelete()}
        onClose={() => !busy && setDeleting(null)}
      />
    </div>
  );
}

/* ---------------- Cronômetro ---------------- */

function TimerCard() {
  const timer = useTimer();
  const { fromKey, validKey } = useAlvos();
  const [pref, setPref] = useState(readPref);
  const [busy, setBusy] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const c = timer.crono;

  const updatePref = (p: Partial<typeof pref>) => {
    const next = { ...pref, ...p };
    setPref(next);
    try {
      localStorage.setItem(PREF_KEY, JSON.stringify(next));
    } catch {
      /* armazenamento indisponível */
    }
  };

  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
    } catch {
      /* erro já mostrado */
    } finally {
      setBusy(false);
    }
  };

  const foco = Math.min(120, Math.max(5, Math.round(pref.foco) || 25));
  const pausa = Math.min(60, Math.max(1, Math.round(pref.pausa) || 5));

  if (!timer.loaded) {
    return <section className="card timer-card skeleton" aria-busy="true" />;
  }

  if (!c) {
    return (
      <section className="card timer-card">
        <h2>Cronômetro</h2>
        <div className="form">
          <div className="field">
            <label htmlFor="timer-alvo">O que vai estudar?</label>
            <AlvoSelect id="timer-alvo" value={validKey(pref.alvo)} onChange={(alvo) => updatePref({ alvo })} />
          </div>
          <div className="segmented" role="radiogroup" aria-label="Modo">
            {(
              [
                ["livre", "Livre"],
                ["pomodoro", "Pomodoro"],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={pref.modo === k}
                className={pref.modo === k ? "active" : ""}
                onClick={() => updatePref({ modo: k })}
              >
                {label}
              </button>
            ))}
          </div>
          {pref.modo === "pomodoro" && (
            <div className="form-row">
              <div className="field">
                <label htmlFor="pomo-foco">Foco (min)</label>
                <input
                  id="pomo-foco"
                  className="input"
                  type="number"
                  min={5}
                  max={120}
                  value={pref.foco}
                  onChange={(e) => updatePref({ foco: Number(e.target.value) })}
                />
              </div>
              <div className="field">
                <label htmlFor="pomo-pausa">Pausa (min)</label>
                <input
                  id="pomo-pausa"
                  className="input"
                  type="number"
                  min={1}
                  max={60}
                  value={pref.pausa}
                  onChange={(e) => updatePref({ pausa: Number(e.target.value) })}
                />
              </div>
            </div>
          )}
          <button
            type="button"
            className="btn btn-primary btn-lg"
            disabled={busy}
            onClick={() => void act(() => timer.start(fromKey(validKey(pref.alvo)), pref.modo, foco, pausa))}
          >
            <Icon name="play" size={20} />
            Começar
          </button>
          <p className="muted small">O cronômetro fica salvo: dá para fechar a aba e continuar depois.</p>
        </div>
      </section>
    );
  }

  const rodando = c.rodandoDesde !== null;
  const fase = c.modo === "pomodoro" ? fasePomodoro(c, timer.now) : null;
  const total = elapsedMs(c, timer.now);
  const estudado = minutosEstudados(c, timer.now);

  return (
    <section className={`card timer-card timer-on${fase && !fase.foco ? " timer-break" : ""}`}>
      <div className="card-head">
        <h2>Cronômetro</h2>
        <span className={`tag ${rodando ? "tone-green" : "tone-amber"}`}>{rodando ? "Rodando" : "Pausado"}</span>
      </div>
      <p className="timer-alvo">
        <Icon name="book" size={16} />
        {c.alvo.nome}
      </p>

      {fase ? (
        <>
          <p className="timer-phase">
            {fase.foco ? "Foco" : "Pausa"} · ciclo {fase.ciclo}
          </p>
          <div className="timer-clock" aria-live="off">
            {fmtRelogio(fase.restanteMs)}
          </div>
          <p className="muted small timer-sub">
            Total {fmtRelogio(total)} · {fmtDuracao(estudado)} de foco
          </p>
        </>
      ) : (
        <div className="timer-clock" aria-live="off">
          {fmtRelogio(total)}
        </div>
      )}

      <div className="timer-actions">
        {rodando ? (
          <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => void act(timer.pause)}>
            <Icon name="pause" size={18} />
            Pausar
          </button>
        ) : (
          <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => void act(timer.resume)}>
            <Icon name="play" size={18} />
            Continuar
          </button>
        )}
        <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void act(timer.finish)}>
          <Icon name="check" size={18} />
          Encerrar e salvar
        </button>
        <button type="button" className="btn btn-quiet" disabled={busy} onClick={() => setConfirmDiscard(true)}>
          Descartar
        </button>
      </div>

      <ConfirmDialog
        open={confirmDiscard}
        title="Descartar cronômetro?"
        message={<p>O tempo marcado ({fmtRelogio(total)}) será perdido e nenhuma sessão será salva.</p>}
        confirmLabel="Descartar"
        busy={busy}
        onConfirm={() => void act(timer.discard).then(() => setConfirmDiscard(false))}
        onClose={() => setConfirmDiscard(false)}
      />
    </section>
  );
}

/* ---------------- Semana ---------------- */

const DIAS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

function WeekCard({ sessoes }: { sessoes: Sessao[] | null }) {
  const seg = inicioSemana();
  const dias = DIAS.map((label, i) => {
    const d = toDateStr(addDays(seg, i));
    const min = somaMinutos((sessoes ?? []).filter((s) => s.inicio.startsWith(d)));
    return { label, d, min };
  });
  const total = dias.reduce((s, x) => s + x.min, 0);
  const max = Math.max(60, ...dias.map((x) => x.min));
  const hoje = todayStr();

  return (
    <section className="card">
      <div className="card-head">
        <h2>Esta semana</h2>
        <span className="week-total">{sessoes ? fmtDuracao(total) : "—"}</span>
      </div>
      <div className="week-bars" role="list" aria-label="Minutos estudados por dia da semana">
        {dias.map((x) => (
          <div key={x.d} className={`week-day${x.d === hoje ? " today" : ""}`} role="listitem" title={`${x.label}: ${fmtDuracao(x.min)}`}>
            <span className="week-bar-track">
              <span className="week-bar" style={{ height: `${Math.round((x.min / max) * 100)}%` }} />
            </span>
            <span className="week-label">{x.label}</span>
            <span className="sr-only">{fmtDuracao(x.min)}</span>
          </div>
        ))}
      </div>
      <p className="muted small">
        {total === 0 ? "Nenhum estudo registrado nesta semana ainda." : `Média de ${fmtDuracao(Math.round(total / 7))} por dia.`}
      </p>
    </section>
  );
}

/* ---------------- Histórico ---------------- */

const ORIGEM: Record<Sessao["origem"], { icon: IconName; label: string }> = {
  cronometro: { icon: "clock", label: "Cronômetro" },
  pomodoro: { icon: "flame", label: "Pomodoro" },
  manual: { icon: "edit", label: "Manual" },
};

function History({
  sessoes,
  onEdit,
  onDelete,
}: {
  sessoes: Sessao[];
  onEdit: (s: Sessao) => void;
  onDelete: (s: Sessao) => void;
}) {
  const grupos = useMemo(() => {
    const map = new Map<string, Sessao[]>();
    for (const s of [...sessoes].reverse()) {
      const d = s.inicio.slice(0, 10);
      map.set(d, [...(map.get(d) ?? []), s]);
    }
    return [...map.entries()];
  }, [sessoes]);

  return (
    <div className="history">
      {grupos.map(([d, list]) => (
        <div key={d} className="history-day">
          <div className="history-day-head">
            <strong>{fmtDia(d)}</strong>
            <span className="muted small">{fmtDuracao(somaMinutos(list))}</span>
          </div>
          <ul className="materials">
            {list.map((s) => (
              <li key={s.id} className="material">
                <span className={`material-icon tone-${s.origem === "manual" ? "ink" : s.origem === "pomodoro" ? "orange" : "blue"}`}>
                  <Icon name={ORIGEM[s.origem].icon} size={18} />
                </span>
                <span className="material-text">
                  <span className="material-title">{s.alvo.nome}</span>
                  <small className="muted">
                    {fmtHora(inicioToDate(s.inicio))}–{fmtHora(fimDe(s))} · {fmtDuracao(s.minutos)} · {ORIGEM[s.origem].label}
                    {s.nota && ` · ${s.nota}`}
                  </small>
                </span>
                <span className="module-actions">
                  <button type="button" className="icon-btn icon-btn-xs" onClick={() => onEdit(s)} aria-label="Editar sessão" title="Editar">
                    <Icon name="edit" size={14} />
                  </button>
                  <button
                    type="button"
                    className="icon-btn icon-btn-xs icon-btn-danger"
                    onClick={() => onDelete(s)}
                    aria-label="Apagar sessão"
                    title="Apagar"
                  >
                    <Icon name="trash" size={14} />
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function fmtDia(d: string): string {
  const hoje = todayStr();
  const ontem = toDateStr(addDays(new Date(), -1));
  if (d === hoje) return "Hoje";
  if (d === ontem) return "Ontem";
  const s = inicioToDate(`${d}T00:00`).toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "short" });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/* ---------------- Formulário ---------------- */

function SessaoForm({
  initial,
  busy,
  onSave,
  onCancel,
}: {
  initial: Sessao | null;
  busy: boolean;
  onSave: (input: SessaoInput) => void;
  onCancel: () => void;
}) {
  const { fromKey, validKey } = useAlvos();
  const agora = new Date();
  const padraoInicio = inicioFromDate(new Date(agora.getTime() - 60 * 60_000));
  const ini = initial?.inicio ?? padraoInicio;
  const [data, setData] = useState(ini.slice(0, 10));
  const [hora, setHora] = useState(ini.slice(11, 16));
  const [horas, setHoras] = useState(String(Math.floor((initial?.minutos ?? 60) / 60)));
  const [mins, setMins] = useState(String((initial?.minutos ?? 60) % 60));
  const [alvoK, setAlvoK] = useState(initial ? alvoKey(initial.alvo) : validKey(readPref().alvo));
  const [nota, setNota] = useState(initial?.nota ?? "");
  const [errors, setErrors] = useState<Partial<Record<"inicio" | "minutos" | "nota" | "alvo", string>>>({});

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const h = Number(horas || 0);
    const m = Number(mins || 0);
    const minutos = Number.isInteger(h) && Number.isInteger(m) && h >= 0 && m >= 0 ? h * 60 + m : NaN;
    const alvo = initial && alvoK === alvoKey(initial.alvo) ? initial.alvo : fromKey(alvoK);
    const r = validateSessao({
      inicio: `${data}T${hora}`,
      minutos,
      alvo,
      origem: initial?.origem ?? "manual",
      nota,
    });
    setErrors(r.errors);
    if (r.value) onSave(r.value);
  };

  return (
    <form className="form" onSubmit={submit} noValidate>
      <div className="field">
        <label htmlFor="ses-alvo">O que você estudou?</label>
        <AlvoSelect id="ses-alvo" value={alvoK} onChange={setAlvoK} current={initial?.alvo} />
      </div>

      <div className="form-row">
        <div className="field">
          <label htmlFor="ses-data">Data</label>
          <input id="ses-data" className="input" type="date" value={data} onChange={(e) => setData(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="ses-hora">Começou às</label>
          <input id="ses-hora" className="input" type="time" value={hora} onChange={(e) => setHora(e.target.value)} />
        </div>
      </div>
      {errors.inicio && <p className="field-error">{errors.inicio}</p>}

      <fieldset className="field">
        <legend>Duração</legend>
        <div className="duracao">
          <div className="input-suffix">
            <input
              className="input"
              type="number"
              min={0}
              max={12}
              value={horas}
              onChange={(e) => setHoras(e.target.value)}
              aria-label="Horas"
            />
            <span aria-hidden="true">h</span>
          </div>
          <div className="input-suffix">
            <input
              className="input"
              type="number"
              min={0}
              max={59}
              value={mins}
              onChange={(e) => setMins(e.target.value)}
              aria-label="Minutos"
            />
            <span aria-hidden="true">min</span>
          </div>
        </div>
        <div className="quick-fill">
          {[25, 30, 45, 60, 90, 120].map((m) => (
            <button
              key={m}
              type="button"
              className="chip"
              onClick={() => {
                setHoras(String(Math.floor(m / 60)));
                setMins(String(m % 60));
              }}
            >
              {fmtDuracao(m)}
            </button>
          ))}
        </div>
        {errors.minutos && <p className="field-error">{errors.minutos}</p>}
      </fieldset>

      <div className="field">
        <label htmlFor="ses-nota">
          Observação <span className="muted">(opcional)</span>
        </label>
        <input
          id="ses-nota"
          className="input"
          value={nota}
          onChange={(e) => setNota(e.target.value)}
          maxLength={200}
          placeholder="Ex.: revisei VPC e subnets"
        />
        {errors.nota && <p className="field-error">{errors.nota}</p>}
      </div>

      <div className="dialog-actions">
        <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={busy}>
          Cancelar
        </button>
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? "Salvando…" : "Salvar"}
        </button>
      </div>
    </form>
  );
}
