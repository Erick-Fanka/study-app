import { useEffect, useMemo, useState } from "react";
import { useServices } from "../services";
import { useProfile } from "../data/ProfileContext";
import { href, type Accent } from "../router";
import { Icon, type IconName } from "../components/Icon";
import { useCatalog } from "../data/CatalogContext";
import { nextModule, progress } from "../data/cursos";
import { ProgressBar } from "../components/Bits";
import { daysUntil, fmtShort, relDays, toDateStr, todayStr } from "../data/dates";
import { addDays, fmtDuracao, inicioSemana, listSessoes, somaMinutos, type Sessao } from "../data/sessoes";
import { KIND, buildItems, listEventos, listRecorrentes, type Evento, type Recorrente } from "../data/agenda";
import { avisos, horasPorArea, porSemana, sequencia } from "../data/painel";
import { useTimer } from "../data/TimerContext";

interface Stat {
  label: string;
  icon: IconName;
  accent: Accent;
  value?: string;
  note: string;
}

const DIAS_SESSOES = 180;

function greeting(d: Date): string {
  const h = d.getHours();
  return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
}

export function HomePage() {
  const { db } = useServices();
  const { displayName } = useProfile();
  const { cursos, areas, certs, error: catError, reload: reloadCatalog } = useCatalog();
  const timer = useTimer();
  const carregando = catError ? "Não carregou" : "Carregando…";

  // Sessões dos últimos 180 dias: sequência, horas por área e por semana.
  const [sessoes, setSessoes] = useState<Sessao[] | null>(null);
  useEffect(() => {
    let active = true;
    listSessoes(db, toDateStr(addDays(new Date(), -(DIAS_SESSOES - 1))), todayStr())
      .then((l) => active && setSessoes(l))
      .catch(() => active && setSessoes([]));
    return () => {
      active = false;
    };
  }, [db, timer.sessionsVersion]);

  // Agenda: prazos atrasados (60 dias), próximos 90 dias e blocos semanais.
  const [agenda, setAgenda] = useState<{ eventos: Evento[]; recorrentes: Recorrente[] } | null>(null);
  useEffect(() => {
    let active = true;
    Promise.all([
      listEventos(db, toDateStr(addDays(new Date(), -60)), toDateStr(addDays(new Date(), 90))),
      listRecorrentes(db),
    ])
      .then(([eventos, recorrentes]) => active && setAgenda({ eventos, recorrentes }))
      .catch(() => active && setAgenda({ eventos: [], recorrentes: [] }));
    return () => {
      active = false;
    };
  }, [db]);

  const hoje = todayStr();
  const seq = sessoes ? sequencia(sessoes, DIAS_SESSOES) : null;
  const semanaMin = sessoes ? somaMinutos(sessoes.filter((s) => s.inicio.slice(0, 10) >= toDateStr(inicioSemana()))) : null;
  const ativos = (cursos ?? []).filter((c) => c.status === "em_andamento");
  const concluidos = (cursos ?? []).filter((c) => c.status === "concluido").length;

  const futuros = useMemo(
    () =>
      agenda && certs
        ? buildItems(hoje, toDateStr(addDays(new Date(), 90)), { ...agenda, certs, sessoes: [] })
        : null,
    [agenda, certs, hoje],
  );
  const proximo = futuros?.find((i) => i.kind !== "bloco" && !i.concluido);
  const hojeItens = futuros?.filter((i) => i.data === hoje) ?? [];
  const listaAvisos = agenda && certs ? avisos(agenda.eventos, certs) : null;

  const stats: Stat[] = [
    {
      label: "Dias seguidos",
      icon: "flame",
      accent: "orange",
      value: seq ? `${seq.atual}${seq.limite ? "+" : ""}` : undefined,
      note: !seq
        ? "Carregando…"
        : seq.atual === 0
          ? "Estude hoje para começar"
          : seq.estudouHoje
            ? `Recorde: ${seq.recorde} dia${seq.recorde === 1 ? "" : "s"}`
            : "Estude hoje para não perder",
    },
    {
      label: "Horas na semana",
      icon: "clock",
      accent: "blue",
      value: semanaMin === null ? undefined : semanaMin === 0 ? "0h" : fmtDuracao(semanaMin),
      note: semanaMin === null ? "Carregando…" : timer.crono ? "Cronômetro rodando" : "Desde segunda-feira",
    },
    {
      label: "Cursos em andamento",
      icon: "book",
      accent: "green",
      value: cursos ? String(ativos.length) : undefined,
      note: cursos ? `${concluidos} concluído${concluidos === 1 ? "" : "s"}` : carregando,
    },
    proximo
      ? {
          label: "Próximo prazo",
          icon: "calendar",
          accent: "ink",
          value: relDays(daysUntil(proximo.data)),
          note: `${proximo.titulo} · ${fmtShort(proximo.data)}`,
        }
      : { label: "Próximo prazo", icon: "calendar", accent: "ink", note: futuros ? "Nada nos próximos 90 dias" : carregando },
  ];

  const now = new Date();
  const firstName = displayName.split(/[\s@]/)[0];
  const today = now.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div className="stack">
      <header className="page-head">
        <p className="eyebrow">{today}</p>
        <h1>
          {greeting(now)}, <span className="text-orange">{firstName}</span>
        </h1>
        <p className="muted">
          {seq && seq.atual > 1 && !seq.estudouHoje
            ? `Você está há ${seq.atual} dias seguidos estudando. Bora manter hoje?`
            : seq && seq.estudouHoje
              ? "Hoje já tem estudo registrado. Mandou bem!"
              : "Bora manter a constância hoje?"}
        </p>
      </header>

      <section className="stats" aria-label="Resumo">
        {stats.map((s) => (
          <article key={s.label} className={`stat tone-${s.accent}`}>
            <span className="stat-icon">
              <Icon name={s.icon} size={20} />
            </span>
            <span className="stat-value">{s.value ?? "—"}</span>
            <span className="stat-label">{s.label}</span>
            <span className="stat-note">{s.note}</span>
          </article>
        ))}
      </section>

      <div className="grid-2">
        <div className="stack">
          <section className="card">
            <div className="card-head">
              <h2>Continuar estudando</h2>
              <a className="link-sm" href={href("/cursos")}>
                Ver todos
              </a>
            </div>
            {cursos === null ? (
              catError ? (
                <p className="muted">
                  Não foi possível carregar seus cursos.{" "}
                  <button type="button" className="link-btn" onClick={() => void reloadCatalog()}>
                    Tentar de novo
                  </button>
                </p>
              ) : (
                <p className="muted">Carregando…</p>
              )
            ) : ativos.length === 0 ? (
              <p className="muted">
                Nenhum curso em andamento.{" "}
                <a href={href("/cursos")}>{cursos.length ? "Comece um curso" : "Cadastre seu primeiro curso"}</a>.
              </p>
            ) : (
              <div className="continue-list">
                {ativos.slice(0, 4).map((c) => {
                  const p = progress(c);
                  const next = nextModule(c);
                  const area = areas?.find((a) => a.id === c.areaId);
                  return (
                    <a key={c.id} className={`continue-item tone-${area?.cor ?? "orange"}`} href={href(`/cursos/${c.id}`)}>
                      <span className="continue-badge" aria-hidden="true">
                        {p.pct}%
                      </span>
                      <span className="continue-text">
                        <strong>{c.nome}</strong>
                        <small className="muted">{next ? `Próximo: ${next.titulo}` : area?.nome ?? ""}</small>
                        <ProgressBar pct={p.pct} label={`Progresso de ${c.nome}`} />
                      </span>
                      <Icon name="arrowRight" size={18} className="shortcut-arrow" />
                    </a>
                  );
                })}
              </div>
            )}
          </section>

          <HorasCard sessoes={sessoes} />
        </div>

        <div className="stack">
          <section className="card">
            <div className="card-head">
              <h2>Avisos</h2>
              {listaAvisos && listaAvisos.length > 0 && <span className="tag tone-orange">{listaAvisos.length}</span>}
            </div>
            {!listaAvisos ? (
              <p className="muted">Carregando…</p>
            ) : listaAvisos.length === 0 ? (
              <p className="muted aviso-ok">
                <Icon name="check" size={16} /> Nenhum prazo apertado. Tudo em dia.
              </p>
            ) : (
              <ul className="avisos">
                {listaAvisos.slice(0, 6).map((a) => (
                  <li key={a.key}>
                    <a className={`aviso aviso-${a.nivel}`} href={href(a.href)}>
                      <Icon name="alert" size={16} />
                      <span>
                        <strong>{a.titulo}</strong>
                        <small>{a.detalhe}</small>
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card">
            <div className="card-head">
              <h2>Hoje na agenda</h2>
              <a className="link-sm" href={href("/agenda")}>
                Abrir agenda
              </a>
            </div>
            {!futuros ? (
              <p className="muted">Carregando…</p>
            ) : hojeItens.length === 0 ? (
              <p className="muted">Nada planejado para hoje.</p>
            ) : (
              <ul className="agenda-list">
                {hojeItens.map((it) => (
                  <li key={it.key} className={`agenda-row tone-${KIND[it.kind].tone}${it.concluido ? " done" : ""}`}>
                    <span className="agenda-time">
                      {it.hora ? <strong>{it.hora}</strong> : <small>Dia todo</small>}
                      {it.fim && <small>{it.fim}</small>}
                    </span>
                    <a className="agenda-body" href={href(it.href ?? "/agenda")}>
                      <span className="agenda-title">{it.titulo}</span>
                      <small className="muted">
                        <span className={`tag tone-${KIND[it.kind].tone}`}>{KIND[it.kind].label}</span>
                        {it.detalhe && ` ${it.detalhe}`}
                      </small>
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Horas de estudo ---------------- */

const PERIODOS = [
  { dias: 7, label: "7 dias" },
  { dias: 30, label: "30 dias" },
  { dias: 90, label: "90 dias" },
];

function HorasCard({ sessoes }: { sessoes: Sessao[] | null }) {
  const { areas } = useCatalog();
  const [dias, setDias] = useState(30);
  const desde = toDateStr(addDays(new Date(), -(dias - 1)));
  const porArea = sessoes ? horasPorArea(sessoes, areas ?? [], desde) : null;
  const total = porArea?.reduce((s, a) => s + a.minutos, 0) ?? 0;
  const maxArea = Math.max(1, ...(porArea ?? []).map((a) => a.minutos));
  const semanas = sessoes ? porSemana(sessoes, 8) : null;
  const maxSem = Math.max(60, ...(semanas ?? []).map((s) => s.minutos));
  const media = semanas ? Math.round(semanas.slice(0, -1).reduce((s, x) => s + x.minutos, 0) / 7) : 0;

  return (
    <section className="card">
      <div className="card-head">
        <h2>Horas de estudo</h2>
        <div className="segmented segmented-sm" role="radiogroup" aria-label="Período">
          {PERIODOS.map((p) => (
            <button
              key={p.dias}
              type="button"
              role="radio"
              aria-checked={dias === p.dias}
              className={dias === p.dias ? "active" : ""}
              onClick={() => setDias(p.dias)}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {!porArea ? (
        <p className="muted">Carregando…</p>
      ) : total === 0 ? (
        <p className="muted">
          Nenhuma hora registrada nesse período. Use o <a href={href("/tempo")}>cronômetro</a>.
        </p>
      ) : (
        <>
          <p className="horas-total">
            <strong>{fmtDuracao(total)}</strong> <span className="muted">nos últimos {dias} dias</span>
          </p>
          <ul className="area-bars" aria-label="Horas por área">
            {porArea.map((a) => (
              <li key={a.areaId || "sem"} className={`tone-${a.cor}`}>
                <span className="area-bar-name">{a.nome}</span>
                <span className="area-bar-track">
                  <span className="area-bar-fill" style={{ width: `${Math.max(2, (a.minutos / maxArea) * 100)}%` }} />
                </span>
                <span className="area-bar-value">{fmtDuracao(a.minutos)}</span>
              </li>
            ))}
          </ul>
        </>
      )}

      {semanas && semanas.some((s) => s.minutos > 0) && (
        <div className="weeks">
          <h3 className="sim-view-title">Últimas 8 semanas</h3>
          <div className="weeks-bars" role="list" aria-label="Horas por semana">
            {semanas.map((s) => (
              <div
                key={s.inicio}
                className={`weeks-col${s.atual ? " atual" : ""}`}
                role="listitem"
                title={`Semana de ${s.label}: ${fmtDuracao(s.minutos)}`}
              >
                <span className="weeks-track">
                  <span className="weeks-fill" style={{ height: `${Math.round((s.minutos / maxSem) * 100)}%` }} />
                </span>
                <span className="weeks-label">{s.label}</span>
                <span className="sr-only">{fmtDuracao(s.minutos)}</span>
              </div>
            ))}
          </div>
          <p className="muted small">Média das 7 semanas anteriores: {fmtDuracao(media)} por semana.</p>
        </div>
      )}
    </section>
  );
}
