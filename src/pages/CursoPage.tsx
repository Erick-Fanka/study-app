import { useState, type FormEvent } from "react";
import { friendlyError } from "../data/store";
import { useCatalog } from "../data/CatalogContext";
import {
  MAX_MODULOS,
  checkModuloTitulo,
  newModulos,
  nextModule,
  parseModuleLines,
  progress,
  type Curso,
  type CursoInput,
  type Modulo,
} from "../data/cursos";
import { nowIso, safeHref } from "../data/validate";
import { MaterialsCard } from "../components/MaterialsCard";
import { href } from "../router";
import { Icon } from "../components/Icon";
import { ConfirmDialog, Dialog } from "../components/Dialog";
import { useToast } from "../components/Toast";
import { CursoForm } from "../components/CursoForm";
import { PrioridadeBadge, ProgressBar, StatusBadge } from "../components/Bits";

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }) : "";

export function CursoPage({ id }: { id: string }) {
  const cat = useCatalog();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  const curso = cat.cursos?.find((c) => c.id === id);
  const area = curso ? cat.areas?.find((a) => a.id === curso.areaId) : undefined;

  if (!cat.cursos || !cat.areas) {
    return (
      <div className="stack" aria-busy="true">
        <div className="card skeleton detail-skeleton" />
      </div>
    );
  }

  if (!curso) {
    return (
      <section className="empty">
        <span className="empty-icon tone-ink">
          <Icon name="alert" size={30} />
        </span>
        <h1>Curso não encontrado</h1>
        <p className="muted">Ele pode ter sido apagado.</p>
        <a className="btn btn-primary" href={href("/cursos")}>
          <Icon name="arrowLeft" size={18} />
          Voltar para Cursos
        </a>
      </section>
    );
  }

  const p = progress(curso);
  const next = nextModule(curso);
  const link = curso.url ? safeHref(curso.url) : undefined;
  const tone = area?.cor ?? "orange";

  const saveModulos = async (modulos: Modulo[], ok?: string) => {
    try {
      await cat.setModulos(curso.id, modulos);
      if (ok) toast.success(ok);
    } catch (e) {
      toast.error(friendlyError(e));
    }
  };

  const toggle = (m: Modulo) =>
    void saveModulos(
      curso.modulos.map((x) =>
        x.id === m.id ? { ...x, concluido: !x.concluido, concluidoEm: x.concluido ? null : nowIso() } : x,
      ),
    );

  const saveCurso = async (input: CursoInput) => {
    setBusy(true);
    try {
      await cat.updateCurso(curso.id, input);
      toast.success("Curso atualizado.");
      setEditing(false);
    } catch (e) {
      toast.error(friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  const doDelete = async () => {
    setBusy(true);
    try {
      await cat.deleteCurso(curso.id);
      toast.success(`Curso “${curso.nome}” apagado.`);
      window.location.hash = "#/cursos";
    } catch (e) {
      toast.error(friendlyError(e));
      setBusy(false);
    }
  };

  return (
    <div className="stack detail">
      <a className="back-link" href={href("/cursos")}>
        <Icon name="arrowLeft" size={16} />
        Cursos
      </a>

      <section className={`card course-hero tone-${tone}`}>
        <div className="course-hero-main">
          <div className="course-hero-tags">
            {area && (
              <span className="tag tone-ink area-tag">
                <span className={`chip-dot tone-${area.cor}`} aria-hidden="true" />
                {area.nome}
              </span>
            )}
            <StatusBadge status={curso.status} />
            <PrioridadeBadge prioridade={curso.prioridade} />
          </div>
          <h1>{curso.nome}</h1>
          {(curso.plataforma || curso.descricao) && (
            <p className="muted">{[curso.plataforma, curso.descricao].filter(Boolean).join(" · ")}</p>
          )}
          <div className="course-hero-actions">
            {link && (
              <a className="btn btn-primary" href={link} target="_blank" rel="noopener noreferrer">
                Abrir curso
                <Icon name="external" size={16} />
              </a>
            )}
            <button type="button" className="btn btn-ghost" onClick={() => setEditing(true)}>
              <Icon name="edit" size={16} />
              Editar
            </button>
            <button type="button" className="btn btn-quiet" onClick={() => setConfirmDelete(true)}>
              <Icon name="trash" size={16} />
              Apagar
            </button>
          </div>
        </div>

        <div className="course-hero-progress">
          <div className="big-pct">
            {p.pct}
            <small>%</small>
          </div>
          <ProgressBar pct={p.pct} tone={curso.status === "concluido" ? "green" : "orange"} />
          <p className="muted small">
            {p.total === 0 ? "Adicione módulos para acompanhar" : `${p.done} de ${p.total} módulos`}
          </p>
          {next && (
            <div className="next-up">
              <span className="eyebrow">Onde parei</span>
              <strong>{next.titulo}</strong>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => toggle(next)}>
                <Icon name="check" size={16} />
                Concluir
              </button>
            </div>
          )}
        </div>
      </section>

      <div className="detail-grid">
        <ModulesCard curso={curso} onSave={saveModulos} onToggle={toggle} />
        <MaterialsCard parentId={curso.id} />
      </div>

      <Dialog open={editing} title="Editar curso" onClose={() => !busy && setEditing(false)}>
        {editing && (
          <CursoForm
            initial={curso}
            areas={cat.areas}
            withModules={false}
            busy={busy}
            onCancel={() => setEditing(false)}
            onSave={(input) => void saveCurso(input)}
          />
        )}
      </Dialog>

      <ConfirmDialog
        open={confirmDelete}
        title="Apagar curso?"
        message={
          <p>
            O curso <strong>{curso.nome}</strong>, seus módulos e materiais serão apagados. Essa ação não pode ser
            desfeita.
          </p>
        }
        confirmLabel="Apagar curso"
        busy={busy}
        onConfirm={() => void doDelete()}
        onClose={() => !busy && setConfirmDelete(false)}
      />
    </div>
  );
}

/* ---------------- Módulos ---------------- */

function ModulesCard({
  curso,
  onSave,
  onToggle,
}: {
  curso: Curso;
  onSave: (modulos: Modulo[], ok?: string) => Promise<void>;
  onToggle: (m: Modulo) => void;
}) {
  const [novo, setNovo] = useState("");
  const [novoErro, setNovoErro] = useState<string>();
  const [editId, setEditId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [deleting, setDeleting] = useState<Modulo | null>(null);
  const mods = curso.modulos;
  const next = nextModule(curso);

  const add = (e: FormEvent) => {
    e.preventDefault();
    const c = checkModuloTitulo(novo);
    if (c.error) return setNovoErro(c.error);
    if (mods.length >= MAX_MODULOS) return setNovoErro(`No máximo ${MAX_MODULOS} módulos.`);
    setNovoErro(undefined);
    setNovo("");
    void onSave([...mods, ...newModulos([c.value])]);
  };

  const parsed = parseModuleLines(pasteText);
  const addPasted = () => {
    if (parsed.error || parsed.titulos.length === 0) return;
    if (mods.length + parsed.titulos.length > MAX_MODULOS) return;
    void onSave([...mods, ...newModulos(parsed.titulos)], `${parsed.titulos.length} módulo(s) adicionados.`);
    setPasteText("");
    setPasteOpen(false);
  };

  const saveEdit = (m: Modulo) => {
    const c = checkModuloTitulo(editText);
    setEditId(null);
    if (c.error || c.value === m.titulo) return;
    void onSave(mods.map((x) => (x.id === m.id ? { ...x, titulo: c.value } : x)));
  };

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= mods.length) return;
    const list = [...mods];
    [list[i], list[j]] = [list[j], list[i]];
    void onSave(list);
  };

  return (
    <section className="card">
      <div className="card-head">
        <h2>
          Módulos <span className="muted count-inline">{mods.length}</span>
        </h2>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setPasteOpen(true)}>
          <Icon name="list" size={16} />
          Colar lista
        </button>
      </div>

      {mods.length === 0 ? (
        <p className="muted">Nenhum módulo ainda. Adicione abaixo ou cole a lista do curso.</p>
      ) : (
        <ol className="modules">
          {mods.map((m, i) => (
            <li key={m.id} className={`module${m.concluido ? " done" : ""}${next?.id === m.id ? " next" : ""}`}>
              <label className="module-check">
                <input type="checkbox" checked={m.concluido} onChange={() => onToggle(m)} />
                <span className="checkbox" aria-hidden="true">
                  {m.concluido && <Icon name="check" size={14} />}
                </span>
                <span className="sr-only">Concluído</span>
              </label>

              {editId === m.id ? (
                <input
                  className="input input-sm"
                  value={editText}
                  autoFocus
                  maxLength={150}
                  onChange={(e) => setEditText(e.target.value)}
                  onBlur={() => saveEdit(m)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveEdit(m);
                    if (e.key === "Escape") setEditId(null);
                  }}
                  aria-label="Nome do módulo"
                />
              ) : (
                <span className="module-text">
                  <span className="module-title">{m.titulo}</span>
                  {m.concluidoEm && <small className="muted">Concluído em {fmtDate(m.concluidoEm)}</small>}
                  {next?.id === m.id && <small className="next-label">Próximo</small>}
                </span>
              )}

              <span className="module-actions">
                <button
                  type="button"
                  className="icon-btn icon-btn-xs"
                  onClick={() => move(i, -1)}
                  disabled={i === 0}
                  aria-label="Mover para cima"
                  title="Mover para cima"
                >
                  <Icon name="chevronUp" size={14} />
                </button>
                <button
                  type="button"
                  className="icon-btn icon-btn-xs"
                  onClick={() => move(i, 1)}
                  disabled={i === mods.length - 1}
                  aria-label="Mover para baixo"
                  title="Mover para baixo"
                >
                  <Icon name="chevronDown" size={14} />
                </button>
                <button
                  type="button"
                  className="icon-btn icon-btn-xs"
                  onClick={() => {
                    setEditId(m.id);
                    setEditText(m.titulo);
                  }}
                  aria-label="Renomear"
                  title="Renomear"
                >
                  <Icon name="edit" size={14} />
                </button>
                <button
                  type="button"
                  className="icon-btn icon-btn-xs icon-btn-danger"
                  onClick={() => setDeleting(m)}
                  aria-label="Apagar módulo"
                  title="Apagar"
                >
                  <Icon name="trash" size={14} />
                </button>
              </span>
            </li>
          ))}
        </ol>
      )}

      <form className="add-row" onSubmit={add} noValidate>
        <input
          className="input"
          value={novo}
          onChange={(e) => setNovo(e.target.value)}
          maxLength={150}
          placeholder="Novo módulo…"
          aria-label="Nome do novo módulo"
        />
        <button type="submit" className="btn btn-primary" aria-label="Adicionar módulo">
          <Icon name="plus" size={18} />
          <span className="hide-sm">Adicionar</span>
        </button>
      </form>
      {novoErro && <p className="field-error">{novoErro}</p>}

      <Dialog open={pasteOpen} title="Colar lista de módulos" onClose={() => setPasteOpen(false)}>
        <div className="form">
          <div className="field">
            <label htmlFor="paste-mods">Um módulo por linha</label>
            <textarea
              id="paste-mods"
              className="input mono"
              rows={8}
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder={"Seção 1 - Introdução\nSeção 2 - VPC\nSeção 3 - IAM"}
              autoFocus
            />
            {parsed.error ? (
              <p className="field-error">{parsed.error}</p>
            ) : mods.length + parsed.titulos.length > MAX_MODULOS ? (
              <p className="field-error">Passaria do limite de {MAX_MODULOS} módulos.</p>
            ) : (
              <p className="muted small">{parsed.titulos.length} módulo(s) serão adicionados ao final.</p>
            )}
          </div>
          <div className="dialog-actions">
            <button type="button" className="btn btn-ghost" onClick={() => setPasteOpen(false)}>
              Cancelar
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={addPasted}
              disabled={!!parsed.error || parsed.titulos.length === 0}
            >
              Adicionar módulos
            </button>
          </div>
        </div>
      </Dialog>

      <ConfirmDialog
        open={deleting !== null}
        title="Apagar módulo?"
        message={
          <p>
            O módulo <strong>{deleting?.titulo}</strong> será removido do curso.
          </p>
        }
        confirmLabel="Apagar módulo"
        onConfirm={() => {
          if (deleting) void onSave(mods.filter((x) => x.id !== deleting.id), "Módulo apagado.");
          setDeleting(null);
        }}
        onClose={() => setDeleting(null)}
      />
    </section>
  );
}
