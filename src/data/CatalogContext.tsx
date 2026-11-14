// Catálogo em memória (áreas + cursos), carregado uma vez ao abrir o app e
// compartilhado entre as telas. Cada alteração grava no armazenamento local e atualiza a memória.

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useServices } from "../services";
import * as A from "./areas";
import * as C from "./cursos";
import * as K from "./certs";
import { deleteAllMateriais } from "./materiais";
import { deleteAllSimulados } from "./simulados";

interface CatalogApi {
  areas: A.Area[] | null;
  cursos: C.Curso[] | null;
  certs: K.Cert[] | null;
  error: unknown;
  reload: () => Promise<void>;

  createCert: (input: K.CertInput, prova?: K.Prova) => Promise<K.Cert>;
  updateCert: (id: string, input: K.CertInput) => Promise<K.Cert>;
  updateProva: (id: string, prova: K.Prova) => Promise<K.Cert>;
  deleteCert: (id: string) => Promise<void>;

  createArea: (input: A.AreaInput) => Promise<A.Area>;
  updateArea: (id: string, input: A.AreaInput) => Promise<A.Area>;
  deleteArea: (id: string) => Promise<void>;
  moveArea: (id: string, dir: -1 | 1) => Promise<void>;

  createCurso: (input: C.CursoInput, modulos: C.Modulo[]) => Promise<C.Curso>;
  updateCurso: (id: string, input: C.CursoInput) => Promise<C.Curso>;
  deleteCurso: (id: string) => Promise<void>;
  /** Grava a lista de módulos (status ajustado automaticamente). Otimista: desfaz se falhar. */
  setModulos: (id: string, modulos: C.Modulo[]) => Promise<void>;
}

const CatalogContext = createContext<CatalogApi | null>(null);

export class AreaNotEmptyError extends Error {}

export function CatalogProvider({ children }: { children: ReactNode }) {
  const { db } = useServices();
  const [areas, setAreas] = useState<A.Area[] | null>(null);
  const [cursos, setCursos] = useState<C.Curso[] | null>(null);
  const [error, setError] = useState<unknown>(null);

  // Refs com o estado atual, para as funções não dependerem de re-render.
  const areasRef = useRef<A.Area[]>([]);
  const cursosRef = useRef<C.Curso[]>([]);
  const commitAreas = (list: A.Area[]) => {
    areasRef.current = A.sortAreas(list);
    setAreas(areasRef.current);
  };
  const commitCursos = (list: C.Curso[]) => {
    cursosRef.current = C.sortCursos(list);
    setCursos(cursosRef.current);
  };
  const [certs, setCerts] = useState<K.Cert[] | null>(null);
  const certsRef = useRef<K.Cert[]>([]);
  const commitCerts = (list: K.Cert[]) => {
    certsRef.current = K.sortCerts(list);
    setCerts(certsRef.current);
  };
  const findCert = (id: string) => {
    const c = certsRef.current.find((x) => x.id === id);
    if (!c) throw new Error("Certificação não encontrada.");
    return c;
  };

  // Fila por curso: gravações de módulos do mesmo curso saem em ordem.
  const queues = useRef(new Map<string, Promise<unknown>>());
  const enqueue = <T,>(key: string, job: () => Promise<T>): Promise<T> => {
    const prev = queues.current.get(key) ?? Promise.resolve();
    const next = prev.catch(() => undefined).then(job);
    queues.current.set(key, next);
    return next;
  };

  const reload = useCallback(async () => {
    setError(null);
    try {
      const [a, c, k] = await Promise.all([A.listAreas(db), C.listCursos(db), K.listCerts(db)]);
      commitAreas(a);
      commitCursos(c);
      commitCerts(k);
    } catch (e) {
      setError(e);
    }
  }, [db]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const api = useMemo<CatalogApi>(
    () => ({
      areas,
      cursos,
      certs,
      error,
      reload,

      async createCert(input, prova) {
        const cert = await K.createCert(db, input, prova);
        commitCerts([...certsRef.current, cert]);
        return cert;
      },

      async updateCert(id, input) {
        const cert = await enqueue(id, () => K.updateCert(db, findCert(id), input));
        commitCerts(certsRef.current.map((c) => (c.id === id ? cert : c)));
        return cert;
      },

      async updateProva(id, prova) {
        const cert = await enqueue(id, () => K.updateProva(db, findCert(id), prova));
        commitCerts(certsRef.current.map((c) => (c.id === id ? cert : c)));
        return cert;
      },

      async deleteCert(id) {
        await enqueue(id, async () => {
          await deleteAllSimulados(db, id);
          await deleteAllMateriais(db, id);
          await K.deleteCert(db, id);
        });
        commitCerts(certsRef.current.filter((c) => c.id !== id));
      },

      async createArea(input) {
        const ordem = areasRef.current.length ? Math.max(...areasRef.current.map((a) => a.ordem)) + 1 : 1;
        const area = await A.createArea(db, input, ordem);
        commitAreas([...areasRef.current, area]);
        return area;
      },

      async updateArea(id, input) {
        const area = await A.updateArea(db, id, input);
        commitAreas(areasRef.current.map((a) => (a.id === id ? area : a)));
        return area;
      },

      async deleteArea(id) {
        if (cursosRef.current.some((c) => c.areaId === id) || certsRef.current.some((c) => c.areaId === id)) {
          throw new AreaNotEmptyError("Mova ou apague os cursos e certificações desta área antes de apagá-la.");
        }
        await A.deleteArea(db, id);
        commitAreas(areasRef.current.filter((a) => a.id !== id));
      },

      async moveArea(id, dir) {
        const list = areasRef.current;
        const i = list.findIndex((a) => a.id === id);
        const j = i + dir;
        if (i < 0 || j < 0 || j >= list.length) return;
        const a = list[i];
        const b = list[j];
        const ordA = b.ordem === a.ordem ? a.ordem + dir : b.ordem;
        const ordB = a.ordem;
        const previous = list;
        commitAreas(list.map((x) => (x.id === a.id ? { ...x, ordem: ordA } : x.id === b.id ? { ...x, ordem: ordB } : x)));
        try {
          await Promise.all([A.setAreaOrder(db, a.id, ordA), A.setAreaOrder(db, b.id, ordB)]);
        } catch (e) {
          commitAreas(previous);
          throw e;
        }
      },

      async createCurso(input, modulos) {
        const curso = await C.createCurso(db, input, modulos);
        commitCursos([...cursosRef.current, curso]);
        return curso;
      },

      async updateCurso(id, input) {
        const curso = await enqueue(id, () => C.updateCurso(db, id, input));
        commitCursos(cursosRef.current.map((c) => (c.id === id ? curso : c)));
        return curso;
      },

      async deleteCurso(id) {
        await enqueue(id, async () => {
          await deleteAllMateriais(db, id);
          await C.deleteCurso(db, id);
        });
        commitCursos(cursosRef.current.filter((c) => c.id !== id));
      },

      async setModulos(id, modulos) {
        const before = cursosRef.current.find((c) => c.id === id);
        if (!before) return;
        const status = C.autoStatus(before.status, modulos);
        commitCursos(cursosRef.current.map((c) => (c.id === id ? { ...c, modulos, status } : c)));
        try {
          await enqueue(id, () => C.saveModulos(db, id, modulos, status));
        } catch (e) {
          commitCursos(cursosRef.current.map((c) => (c.id === id ? before : c)));
          throw e;
        }
      },
    }),
    [areas, cursos, certs, error, reload, db],
  );

  return <CatalogContext.Provider value={api}>{children}</CatalogContext.Provider>;
}

export function useCatalog(): CatalogApi {
  const c = useContext(CatalogContext);
  if (!c) throw new Error("CatalogProvider ausente");
  return c;
}
