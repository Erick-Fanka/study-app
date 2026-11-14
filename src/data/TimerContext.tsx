// Cronômetro global: visível em qualquer tela (aviso no topo), salvo no navegador
// e relido quando a aba volta ao foco (para pegar o que foi feito em outra aba).

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useServices } from "../services";
import { useToast } from "../components/Toast";
import { friendlyError } from "./store";
import {
  clearCrono,
  elapsedMs,
  fasePomodoro,
  fmtRelogio,
  loadCrono,
  minutosEstudados,
  saveCrono,
  type Crono,
  type ModoCrono,
} from "./cronometro";
import { createSessao, fmtDuracao, inicioFromDate, type Alvo, type Sessao } from "./sessoes";

interface TimerApi {
  crono: Crono | null;
  loaded: boolean;
  now: number;
  /** Muda sempre que uma sessão é criada/alterada; telas usam para recarregar. */
  sessionsVersion: number;
  bumpSessions: () => void;
  start: (alvo: Alvo, modo: ModoCrono, focoMin: number, pausaMin: number) => Promise<void>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  finish: () => Promise<Sessao | null>;
  discard: () => Promise<void>;
  refresh: () => Promise<void>;
}

const TimerContext = createContext<TimerApi | null>(null);

export function TimerProvider({ children }: { children: ReactNode }) {
  const { db } = useServices();
  const toast = useToast();
  const [crono, setCrono] = useState<Crono | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [sessionsVersion, setSessionsVersion] = useState(0);
  const lastPhase = useRef<string>("");

  const refresh = useCallback(async () => {
    try {
      setCrono(await loadCrono(db));
    } catch {
      /* mantém o estado atual se a leitura falhar */
    } finally {
      setLoaded(true);
    }
  }, [db]);

  useEffect(() => {
    void refresh();
    const onVisible = () => document.visibilityState === "visible" && void refresh();
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [refresh]);

  // Relógio: só tica enquanto estiver rodando.
  useEffect(() => {
    if (!crono?.rodandoDesde) return;
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [crono?.rodandoDesde]);

  // Pomodoro: avisa na troca entre foco e pausa.
  useEffect(() => {
    if (!crono || crono.modo !== "pomodoro" || !crono.rodandoDesde) {
      lastPhase.current = "";
      return;
    }
    const f = fasePomodoro(crono, now);
    const key = `${f.ciclo}-${f.foco}`;
    if (lastPhase.current && lastPhase.current !== key) {
      toast.success(f.foco ? `Hora de voltar ao foco (ciclo ${f.ciclo}).` : `Pausa de ${crono.pausaMin} min. Levanta e alonga!`);
      try {
        navigator.vibrate?.([200, 100, 200]);
      } catch {
        /* sem vibração */
      }
    }
    lastPhase.current = key;
  }, [crono, now, toast]);

  // Título da aba mostra o tempo enquanto roda.
  useEffect(() => {
    const base = "study.app";
    if (!crono) {
      document.title = base;
      return;
    }
    const txt =
      crono.modo === "pomodoro"
        ? `${fasePomodoro(crono, now).foco ? "Foco" : "Pausa"} ${fmtRelogio(fasePomodoro(crono, now).restanteMs)}`
        : fmtRelogio(elapsedMs(crono, now));
    document.title = `${crono.rodandoDesde ? "▶" : "❚❚"} ${txt} · ${base}`;
  }, [crono, now]);

  useEffect(() => () => void (document.title = "study.app"), []);

  const bumpSessions = useCallback(() => setSessionsVersion((v) => v + 1), []);

  const persist = useCallback(
    async (next: Crono | null, previous: Crono | null) => {
      setCrono(next);
      setNow(Date.now());
      try {
        if (next) await saveCrono(db, next);
        else await clearCrono(db);
      } catch (e) {
        setCrono(previous);
        toast.error(friendlyError(e));
        throw e;
      }
    },
    [db, toast],
  );

  const api = useMemo<TimerApi>(
    () => ({
      crono,
      loaded,
      now,
      sessionsVersion,
      bumpSessions,
      refresh,

      async start(alvo, modo, focoMin, pausaMin) {
        const c: Crono = {
          alvo,
          modo,
          focoMin,
          pausaMin,
          inicio: inicioFromDate(new Date()),
          acumuladoMs: 0,
          rodandoDesde: Date.now(),
        };
        await persist(c, crono);
      },

      async pause() {
        if (!crono?.rodandoDesde) return;
        await persist({ ...crono, acumuladoMs: elapsedMs(crono), rodandoDesde: null }, crono);
      },

      async resume() {
        if (!crono || crono.rodandoDesde) return;
        await persist({ ...crono, rodandoDesde: Date.now() }, crono);
      },

      async finish() {
        if (!crono) return null;
        const minutos = Math.min(12 * 60, minutosEstudados(crono));
        if (minutos < 1) {
          toast.error("Menos de 1 minuto de estudo: nada foi salvo. Use “Descartar” para zerar.");
          return null;
        }
        try {
          const s = await createSessao(db, {
            inicio: crono.inicio,
            minutos,
            alvo: crono.alvo,
            origem: crono.modo === "pomodoro" ? "pomodoro" : "cronometro",
            nota: "",
          });
          await persist(null, crono);
          bumpSessions();
          toast.success(`Sessão salva: ${fmtDuracao(minutos)} em ${s.alvo.nome}.`);
          return s;
        } catch (e) {
          toast.error(friendlyError(e));
          return null;
        }
      },

      async discard() {
        await persist(null, crono);
      },
    }),
    [crono, loaded, now, sessionsVersion, bumpSessions, refresh, persist, db, toast],
  );

  return <TimerContext.Provider value={api}>{children}</TimerContext.Provider>;
}

export function useTimer(): TimerApi {
  const t = useContext(TimerContext);
  if (!t) throw new Error("TimerProvider ausente");
  return t;
}
