import { useCallback, useEffect, useMemo, useState } from "react";
import { useServices } from "../services";
import { friendlyError } from "../data/store";
import { useCatalog } from "../data/CatalogContext";
import { useTimer } from "../data/TimerContext";
import {
  KIND,
  buildItems,
  deleteEvento,
  deleteRecorrente,
  listEventos,
  listRecorrentes,
  saveEvento,
  setConcluido,
  type AgendaItem,
  type Evento,
  type EventoInput,
  type Recorrente,
} from "../data/agenda";
import { listSessoes, addDays, inicioSemana, fmtDuracao } from "../data/sessoes";
import { parseDate, relDays, daysUntil, toDateStr, todayStr } from "../data/dates";
import { href } from "../router";
import { Icon } from "../components/Icon";
import { ConfirmDialog, Dialog } from "../components/Dialog";
import { useToast } from "../components/Toast";
import { EventoForm } from "../components/EventoForm";
import { TimeGrid } from "../components/TimeGrid";

type View = "proximos" | "semana" | "dia" | "mes";
type Modal = { mode: "create"; data?: string; hora?: string } | { mode: "edit"; evento?: Evento; recorrente?: Recorrente } | null;

const VIEW_KEY = "estudos.agenda.view";

function readView(): View {
  try {
    const v = localStorage.getItem(VIEW_KEY);
    return v === "mes" || v === "semana" || v === "dia" ? v : "proximos";
  } catch {
    return "proximos";
  }
}

/** Carrega eventos, repetições e sessões de um período e junta com as datas das certificações. */
function useAgenda(de: string, ate: string, version: number) {
  const { db } = useServices();
  const { certs } = useCatalog();
  const timer = useTimer();
  const [raw, setRaw] = useState<{ eventos: Evento[]; recorrentes: Recorrente[]; sessoes: Awaited<ReturnType<typeof listSessoes>> } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setError(null);
    Promise.all([listEventos(db, de, ate), listRecorrentes(db), listSessoes(db, de, ate)])
      .then(([eventos, recorrentes, sessoes]) => active && setRaw({ eventos, recorrentes, sessoes }))
      .catch((e) => active && setError(friendlyError(e)));
    return () => {
      active = false;
    };
  }, [db, de, ate, version, timer.sessionsVersion]);

  const items = useMemo(
    () => (raw ? buildItems(de, ate, { ...raw, certs: certs ?? [] }) : null),
    [raw, certs, de, ate],
  );
  return { items, error, setRaw };
}

export function AgendaPage() {
  const { db } = useServices();
  const toast = useToast();
  const [view, setViewState] = useState<View>(readView);
  const [version, setVersion] = useState(0);
  const [modal, setModal] = useState<Modal>(null);
  const [confirmDel, setConfirmDel] = useState<{ evento?: Evento; recorrente?: Recorrente } | null>(null);
  const [busy, setBusy] = useState(false);

  const setView = (v: View) => {
    setViewState(v);
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {
      /* armazenamento indisponível */
    }
  };

  const bump = useCallback(() => setVersion((v) => v + 1), []);

  const save = async (input: EventoInput) => {
    setBusy(true);
    try {
      await saveEvento(db, input, modal?.mode === "edit" ? modal : undefined);
      toast.success(modal?.mode === "edit" ? "Evento atualizado." : input.repetir ? "Bloco semanal criado." : "Evento criado.");
      setModal(null);
      bump();
    } catch (e) {
      toast.error(friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  const doDelete = async () => {
    if (!confirmDel) return;
    setBusy(true);
    try {
      if (confirmDel.recorrente) await deleteRecorrente(db, confirmDel.recorrente);
      else if (confirmDel.evento) await deleteEvento(db, confirmDel.evento);
      toast.success("Evento apagado.");
      setConfirmDel(null);
      setModal(null);
      bump();
    } catch (e) {
      toast.error(friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  const toggleConcluido = async (e: Evento) => {
    try {
      await setConcluido(db, e, !e.concluido);
      toast.success(e.concluido ? "Prazo reaberto." : "Prazo concluído.");
      bump();
    } catch (err) {
      toast.error(friendlyError(err));
    }
  };

  const openItem = (it: AgendaItem) => {
    if (it.evento) setModal({ mode: "edit", evento: it.evento });
    else if (it.recorrente) setModal({ mode: "edit", recorrente: it.recorrente });
    else if (it.href) window.location.hash = `#${it.href}`;
    else if (it.sessao) window.location.hash = "#/tempo";
  };

  const rowProps = { onOpen: openItem, onToggle: (e: Evento) => void toggleConcluido(e) };

  return (
    <div className="stack">
      <header className="page-head page-head-row">
        <div>
          <p className="eyebrow">Planejamento</p>
          <h1>Agenda</h1>
          <p className="muted">Blocos de estudo, prazos, provas e o que você já estudou.</p>
        </div>
        <div className="head-actions">
          <button type="button" className="btn btn-primary" onClick={() => setModal({ mode: "create" })}>
            <Icon name="plus" size={18} />
            Novo evento
          </button>
        </div>
      </header>

      <div className="segmented" role="tablist" aria-label="Visão da agenda">
        {(
          [
            ["proximos", "Próximos"],
            ["dia", "Dia"],
            ["semana", "Semana"],
            ["mes", "Mês"],
          ] as const
        ).map(([k, label]) => (
          <button key={k} type="button" role="tab" aria-selected={view === k} className={view === k ? "active" : ""} onClick={() => setView(k)}>
            {label}
          </button>
        ))}
      </div>

      {view === "proximos" && (
        <ProximosView version={version} {...rowProps} onNew={(data) => setModal({ mode: "create", data })} />
      )}
      {(view === "semana" || view === "dia") && (
        <GradeView
          modo={view}
          version={version}
          onOpen={openItem}
          onNewAt={(data, hora) => setModal({ mode: "create", data, hora })}
        />
      )}
      {view === "mes" && (
        <MesView version={version} {...rowProps} onNew={(data) => setModal({ mode: "create", data })} />
      )}

      <Dialog
        open={modal !== null}
        title={modal?.mode === "edit" ? (modal.recorrente ? "Editar bloco semanal" : "Editar evento") : "Novo evento"}
        onClose={() => !busy && setModal(null)}
      >
        {modal && (
          <EventoForm
            key={modal.mode === "edit" ? (modal.evento?.id ?? modal.recorrente?.id) : `new-${modal.data ?? ""}-${modal.hora ?? ""}`}
            evento={modal.mode === "edit" ? modal.evento : undefined}
            recorrente={modal.mode === "edit" ? modal.recorrente : undefined}
            dataPadrao={modal.mode === "create" ? modal.data : undefined}
            horaPadrao={modal.mode === "create" ? modal.hora : undefined}
            busy={busy}
            onCancel={() => setModal(null)}
            onSave={(input) => void save(input)}
            onDelete={modal.mode === "edit" ? () => setConfirmDel(modal) : undefined}
          />
        )}
      </Dialog>

      <ConfirmDialog
        open={confirmDel !== null}
        title={confirmDel?.recorrente ? "Apagar bloco semanal?" : "Apagar evento?"}
        message={
          <p>
            {confirmDel?.recorrente
              ? "Todas as repetições deste bloco serão removidas da agenda."
              : "Este evento será removido da agenda."}
          </p>
        }
        confirmLabel="Apagar"
        busy={busy}
        onConfirm={() => void doDelete()}
        onClose={() => !busy && setConfirmDel(null)}
      />
    </div>
  );
}

/* ---------------- Linha de item ---------------- */

interface RowProps {
  onOpen: (it: AgendaItem) => void;
  onToggle: (e: Evento) => void;
}

function AgendaRow({ it, onOpen, onToggle }: { it: AgendaItem } & RowProps) {
  const k = KIND[it.kind];
  const atrasado = it.kind === "prazo" && !it.concluido && it.data < todayStr();
  return (
    <li className={`agenda-row tone-${k.tone}${it.concluido ? " done" : ""}`}>
      <span className="agenda-time">
        {it.hora ? (
          <>
            <strong>{it.hora}</strong>
            {it.fim && <small>{it.fim}</small>}
          </>
        ) : (
          <small>Dia todo</small>
        )}
      </span>
      {it.kind === "prazo" && it.evento && (
        <label className="module-check" title={it.concluido ? "Reabrir prazo" : "Marcar como concluído"}>
          <input type="checkbox" checked={!!it.concluido} onChange={() => onToggle(it.evento!)} />
          <span className="checkbox" aria-hidden="true">
            {it.concluido && <Icon name="check" size={14} />}
          </span>
          <span className="sr-only">Concluído</span>
        </label>
      )}
      <button type="button" className="agenda-body" onClick={() => onOpen(it)}>
        <span className="agenda-title">{it.titulo}</span>
        <small className="muted">
          <span className={`tag tone-${k.tone}`}>{k.label}</span>
          {it.minutos ? ` ${fmtDuracao(it.minutos)}` : ""}
          {it.detalhe && ` ${it.detalhe}`}
          {atrasado && <span className="tag tone-red tag-inline">atrasado</span>}
        </small>
      </button>
    </li>
  );
}

function fmtDiaLongo(d: string): string {
  const s = parseDate(d).toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/* ---------------- Próximos ---------------- */

function ProximosView({ version, onNew, ...row }: { version: number; onNew: (data?: string) => void } & RowProps) {
  const hoje = todayStr();
  const de = toDateStr(addDays(new Date(), -60));
  const ate = toDateStr(addDays(new Date(), 60));
  const { items, error } = useAgenda(de, ate, version);

  if (error) return <p className="field-error">{error}</p>;
  if (!items) return <div className="card skeleton detail-skeleton" aria-busy="true" />;

  const atrasados = items.filter((i) => i.kind === "prazo" && !i.concluido && i.data < hoje);
  const futuros = items.filter((i) => i.data >= hoje && i.kind !== "sessao");
  const estudadoHoje = items.filter((i) => i.data === hoje && i.kind === "sessao").reduce((s, i) => s + (i.minutos ?? 0), 0);

  const grupos = new Map<string, AgendaItem[]>();
  grupos.set(hoje, []);
  for (const it of futuros) grupos.set(it.data, [...(grupos.get(it.data) ?? []), it]);

  return (
    <div className="stack">
      {atrasados.length > 0 && (
        <section className="card agenda-day agenda-late">
          <div className="agenda-day-head">
            <h2>Prazos atrasados</h2>
            <span className="tag tone-red">{atrasados.length}</span>
          </div>
          <ul className="agenda-list">
            {atrasados.map((it) => (
              <AgendaRow key={it.key} it={it} {...row} />
            ))}
          </ul>
        </section>
      )}

      {[...grupos.entries()].map(([d, list]) => {
        const dias = daysUntil(d);
        return (
          <section key={d} className={`card agenda-day${d === hoje ? " agenda-today" : ""}`}>
            <div className="agenda-day-head">
              <h2>
                {d === hoje ? "Hoje" : dias === 1 ? "Amanhã" : fmtDiaLongo(d)}
                {d !== hoje && dias > 1 && <small className="muted"> · {relDays(dias)}</small>}
              </h2>
              {d === hoje && estudadoHoje > 0 && <span className="tag tone-green">{fmtDuracao(estudadoHoje)} estudados</span>}
            </div>
            {list.length === 0 ? (
              <p className="muted agenda-empty">
                Nada planejado.{" "}
                <button type="button" className="link-btn" onClick={() => onNew(d)}>
                  Planejar um bloco de estudo
                </button>
              </p>
            ) : (
              <ul className="agenda-list">
                {list.map((it) => (
                  <AgendaRow key={it.key} it={it} {...row} />
                ))}
              </ul>
            )}
          </section>
        );
      })}

      {futuros.length === 0 && (
        <p className="muted center-text">Nada nos próximos 60 dias. Crie blocos de estudo e prazos em “Novo evento”.</p>
      )}
    </div>
  );
}

/* ---------------- Mês ---------------- */

const DIAS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

function MesView({ version, onNew, ...row }: { version: number; onNew: (data?: string) => void } & RowProps) {
  const hoje = todayStr();
  const [mes, setMes] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [sel, setSel] = useState<string>(hoje);

  const inicio = inicioSemana(mes);
  const fimMes = new Date(mes.getFullYear(), mes.getMonth() + 1, 0);
  const fim = addDays(inicioSemana(fimMes), 6);
  const de = toDateStr(inicio);
  const ate = toDateStr(fim);
  const { items, error } = useAgenda(de, ate, version);

  const dias: string[] = [];
  for (let d = new Date(inicio); d <= fim; d.setDate(d.getDate() + 1)) dias.push(toDateStr(d));

  const porDia = useMemo(() => {
    const m = new Map<string, AgendaItem[]>();
    for (const it of items ?? []) m.set(it.data, [...(m.get(it.data) ?? []), it]);
    return m;
  }, [items]);

  const titulo = mes.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  const mover = (n: number) => setMes((m) => new Date(m.getFullYear(), m.getMonth() + n, 1));
  const irHoje = () => {
    const d = new Date();
    setMes(new Date(d.getFullYear(), d.getMonth(), 1));
    setSel(hoje);
  };

  const selItems = porDia.get(sel) ?? [];

  return (
    <div className="month-layout">
      <section className="card month-card">
        <div className="month-head">
          <h2 className="month-title">{titulo.charAt(0).toUpperCase() + titulo.slice(1)}</h2>
          <div className="month-nav">
            <button type="button" className="icon-btn icon-btn-sm" onClick={() => mover(-1)} aria-label="Mês anterior">
              <Icon name="arrowLeft" size={16} />
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={irHoje}>
              Hoje
            </button>
            <button type="button" className="icon-btn icon-btn-sm" onClick={() => mover(1)} aria-label="Próximo mês">
              <Icon name="arrowRight" size={16} />
            </button>
          </div>
        </div>

        {error && <p className="field-error">{error}</p>}

        <div className="month-grid" role="grid" aria-label={titulo} aria-busy={!items}>
          {DIAS.map((d) => (
            <div key={d} className="month-dow" role="columnheader">
              {d}
            </div>
          ))}
          {dias.map((d) => {
            const list = porDia.get(d) ?? [];
            const eventos = list.filter((i) => i.kind !== "sessao");
            const estudado = list.filter((i) => i.kind === "sessao").reduce((s, i) => s + (i.minutos ?? 0), 0);
            const fora = parseDate(d).getMonth() !== mes.getMonth();
            return (
              <button
                key={d}
                type="button"
                role="gridcell"
                aria-selected={d === sel}
                className={`month-cell${fora ? " out" : ""}${d === hoje ? " today" : ""}${d === sel ? " selected" : ""}`}
                onClick={() => setSel(d)}
                aria-label={`${fmtDiaLongo(d)}: ${eventos.length} evento(s)${estudado ? `, ${fmtDuracao(estudado)} estudados` : ""}`}
              >
                <span className="month-num">{parseDate(d).getDate()}</span>
                <span className="month-chips">
                  {eventos.slice(0, 3).map((it) => (
                    <span key={it.key} className={`month-chip tone-${KIND[it.kind].tone}${it.concluido ? " done" : ""}`}>
                      {it.hora && <b>{it.hora}</b>} {it.titulo}
                    </span>
                  ))}
                  {eventos.length > 3 && <span className="month-more">+{eventos.length - 3}</span>}
                </span>
                <span className="month-dots" aria-hidden="true">
                  {eventos.slice(0, 4).map((it) => (
                    <i key={it.key} className={`tone-${KIND[it.kind].tone}`} />
                  ))}
                </span>
                {estudado > 0 && <span className="month-study">{fmtDuracao(estudado)}</span>}
              </button>
            );
          })}
        </div>
      </section>

      <section className="card agenda-day">
        <div className="agenda-day-head">
          <h2>{sel === hoje ? "Hoje" : fmtDiaLongo(sel)}</h2>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => onNew(sel)}>
            <Icon name="plus" size={16} />
            Evento
          </button>
        </div>
        {selItems.length === 0 ? (
          <p className="muted agenda-empty">Nada neste dia.</p>
        ) : (
          <ul className="agenda-list">
            {selItems.map((it) => (
              <AgendaRow key={it.key} it={it} {...row} />
            ))}
          </ul>
        )}
        <p className="muted small">
          <a href={href("/tempo")}>Registrar tempo estudado</a>
        </p>
      </section>
    </div>
  );
}

/* ---------------- Semana e Dia ---------------- */

function GradeView({
  modo,
  version,
  onOpen,
  onNewAt,
}: {
  modo: "semana" | "dia";
  version: number;
  onOpen: (it: AgendaItem) => void;
  onNewAt: (data: string, hora: string) => void;
}) {
  const hoje = todayStr();
  const [ref, setRef] = useState(hoje);
  const base = parseDate(ref);
  const dias =
    modo === "dia" ? [ref] : Array.from({ length: 7 }, (_, i) => toDateStr(addDays(inicioSemana(base), i)));
  const { items, error } = useAgenda(dias[0], dias[dias.length - 1], version);

  const porDia = useMemo(() => {
    const m = new Map<string, AgendaItem[]>();
    for (const it of items ?? []) m.set(it.data, [...(m.get(it.data) ?? []), it]);
    return m;
  }, [items]);

  const passo = modo === "dia" ? 1 : 7;
  const mover = (n: number) => setRef(toDateStr(addDays(base, n * passo)));

  const ini = parseDate(dias[0]);
  const fim = parseDate(dias[dias.length - 1]);
  const titulo =
    modo === "dia"
      ? fmtDiaLongo(ref)
      : `${ini.getDate()}${ini.getMonth() !== fim.getMonth() ? ` ${ini.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "")}` : ""} – ${fim.toLocaleDateString("pt-BR", { day: "numeric", month: "long" })}`;
  const estudado = (items ?? []).filter((i) => i.kind === "sessao").reduce((s, i) => s + (i.minutos ?? 0), 0);

  return (
    <section className="card month-card">
      <div className="month-head">
        <div>
          <h2 className="month-title">{titulo}</h2>
          {estudado > 0 && <p className="muted small">{fmtDuracao(estudado)} estudados {modo === "dia" ? "neste dia" : "nesta semana"}</p>}
        </div>
        <div className="month-nav">
          <button type="button" className="icon-btn icon-btn-sm" onClick={() => mover(-1)} aria-label={modo === "dia" ? "Dia anterior" : "Semana anterior"}>
            <Icon name="arrowLeft" size={16} />
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setRef(hoje)}>
            Hoje
          </button>
          <button type="button" className="icon-btn icon-btn-sm" onClick={() => mover(1)} aria-label={modo === "dia" ? "Próximo dia" : "Próxima semana"}>
            <Icon name="arrowRight" size={16} />
          </button>
        </div>
      </div>
      {error && <p className="field-error">{error}</p>}
      {!items && !error && <div className="skeleton detail-skeleton" aria-busy="true" />}
      {items && <TimeGrid dias={dias} porDia={porDia} onOpen={onOpen} onNewAt={onNewAt} />}
    </section>
  );
}
