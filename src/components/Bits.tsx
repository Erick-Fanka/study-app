// Pequenos componentes visuais reutilizados.

import { STATUS, PRIORIDADE, type CursoStatus, type Prioridade } from "../data/cursos";

export function ProgressBar({ pct, tone = "orange", label }: { pct: number; tone?: string; label?: string }) {
  const value = Math.max(0, Math.min(100, Math.round(pct)));
  return (
    <div
      className={`progress tone-${tone}`}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={value}
      aria-label={label ?? "Progresso"}
    >
      <span className="progress-fill" style={{ width: `${value}%` }} />
    </div>
  );
}

export function StatusBadge({ status }: { status: CursoStatus }) {
  const s = STATUS[status];
  return <span className={`tag tone-${s.tone}`}>{s.label}</span>;
}

export function PrioridadeBadge({ prioridade }: { prioridade: Prioridade }) {
  const p = PRIORIDADE[prioridade];
  return <span className={`tag tag-outline tone-${p.tone}`}>Prioridade {p.label.toLowerCase()}</span>;
}
