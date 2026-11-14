// Seletor "o que você vai estudar": só o que ainda está em andamento —
// cursos não concluídos e certificações em estudo ou com prova agendada.

import { useCatalog } from "../data/CatalogContext";
import { ALVO_LIVRE, type Alvo } from "../data/sessoes";

export function alvoKey(a: Alvo): string {
  return a.tipo === "livre" ? "livre" : `${a.tipo}:${a.id}`;
}

export function useAlvos(): { alvos: Alvo[]; fromKey: (key: string) => Alvo; validKey: (key: string) => string } {
  const { cursos, certs } = useCatalog();
  const alvos: Alvo[] = [
    ...(cursos ?? [])
      .filter((c) => c.status !== "concluido")
      .map((c) => ({ tipo: "curso" as const, id: c.id, nome: c.nome, areaId: c.areaId })),
    ...(certs ?? [])
      .filter((c) => c.status === "estudando" || c.status === "agendada")
      .map((c) => ({ tipo: "cert" as const, id: c.id, nome: c.codigo ? `${c.codigo} · ${c.nome}` : c.nome, areaId: c.areaId })),
  ];
  const fromKey = (key: string) => alvos.find((a) => alvoKey(a) === key) ?? ALVO_LIVRE;
  /** Se a chave salva não está mais disponível (ex.: curso concluído), volta para "livre". */
  const validKey = (key: string) => (alvos.some((a) => alvoKey(a) === key) ? key : "livre");
  return { alvos, fromKey, validKey };
}

export function AlvoSelect({
  id,
  value,
  onChange,
  current,
}: {
  id: string;
  value: string;
  onChange: (key: string) => void;
  /** Alvo já gravado num registro antigo (ex.: curso hoje concluído) para não sumir ao editar. */
  current?: Alvo;
}) {
  const { alvos } = useAlvos();
  const { cursos, certs } = useCatalog();
  const cursosAtivos = alvos.filter((a) => a.tipo === "curso");
  const certsAtivas = alvos.filter((a) => a.tipo === "cert");
  const fora = current && current.tipo !== "livre" && !alvos.some((a) => alvoKey(a) === alvoKey(current));
  const aindaExiste =
    fora &&
    (current.tipo === "curso" ? cursos?.some((c) => c.id === current.id) : certs?.some((c) => c.id === current.id));

  return (
    <select id={id} className="input" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="livre">Estudo livre (sem curso)</option>
      {cursosAtivos.length > 0 && (
        <optgroup label="Cursos em andamento">
          {cursosAtivos.map((a) => (
            <option key={alvoKey(a)} value={alvoKey(a)}>
              {a.nome}
            </option>
          ))}
        </optgroup>
      )}
      {certsAtivas.length > 0 && (
        <optgroup label="Certificações em preparação">
          {certsAtivas.map((a) => (
            <option key={alvoKey(a)} value={alvoKey(a)}>
              {a.nome}
            </option>
          ))}
        </optgroup>
      )}
      {fora && (
        <option value={alvoKey(current)}>
          {current.nome} ({aindaExiste ? "concluído" : "removido"})
        </option>
      )}
    </select>
  );
}
