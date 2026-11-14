import { useEffect, useState, type FormEvent } from "react";
import { useServices } from "../services";
import { friendlyError } from "../data/store";
import {
  MATERIAL_TIPOS,
  createMaterial,
  deleteMaterial,
  listMateriais,
  setMaterialFeito,
  updateMaterial,
  validateMaterial,
  type Material,
  type MaterialInput,
  type MaterialTipo,
} from "../data/materiais";
import { safeHref } from "../data/validate";
import { Icon } from "./Icon";
import { ConfirmDialog, Dialog } from "./Dialog";
import { useToast } from "./Toast";

/* ---------------- Materiais e labs ---------------- */

type MatModal = { mode: "create" } | { mode: "edit"; m: Material } | null;

export function MaterialsCard({ parentId }: { parentId: string }) {
  const { db } = useServices();
  const toast = useToast();
  const [list, setList] = useState<Material[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<MatModal>(null);
  const [deleting, setDeleting] = useState<Material | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    listMateriais(db, parentId)
      .then((l) => active && setList(l))
      .catch((e) => active && setError(friendlyError(e)));
    return () => {
      active = false;
    };
  }, [db, parentId]);

  const save = async (input: MaterialInput) => {
    setBusy(true);
    try {
      if (modal?.mode === "edit") {
        const updated = await updateMaterial(db, modal.m, input);
        setList((l) => (l ?? []).map((x) => (x.id === updated.id ? updated : x)));
        toast.success("Material atualizado.");
      } else {
        const created = await createMaterial(db, parentId, input);
        setList((l) => [...(l ?? []), created]);
        toast.success("Material adicionado.");
      }
      setModal(null);
    } catch (e) {
      toast.error(friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  const toggleFeito = async (m: Material) => {
    setList((l) => (l ?? []).map((x) => (x.id === m.id ? { ...x, feito: !m.feito } : x)));
    try {
      await setMaterialFeito(db, m, !m.feito);
    } catch (e) {
      setList((l) => (l ?? []).map((x) => (x.id === m.id ? m : x)));
      toast.error(friendlyError(e));
    }
  };

  const doDelete = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      await deleteMaterial(db, deleting);
      setList((l) => (l ?? []).filter((x) => x.id !== deleting.id));
      toast.success("Material apagado.");
      setDeleting(null);
    } catch (e) {
      toast.error(friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  const labs = list?.filter((m) => m.tipo === "lab") ?? [];
  const labsDone = labs.filter((m) => m.feito).length;

  return (
    <section className="card">
      <div className="card-head">
        <h2>
          Materiais e labs <span className="muted count-inline">{list?.length ?? ""}</span>
        </h2>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setModal({ mode: "create" })}>
          <Icon name="plus" size={16} />
          Adicionar
        </button>
      </div>

      {labs.length > 0 && (
        <p className="muted small labs-summary">
          <Icon name="flask" size={14} />
          {labsDone} de {labs.length} labs feitos
        </p>
      )}

      {error && <p className="field-error">{error}</p>}
      {!error && list === null && <p className="muted">Carregando…</p>}
      {list && list.length === 0 && (
        <p className="muted">Guarde aqui links, PDFs, vídeos, documentação e labs práticos.</p>
      )}

      {list && list.length > 0 && (
        <ul className="materials">
          {list.map((m) => {
            const t = MATERIAL_TIPOS[m.tipo];
            const url = m.url ? safeHref(m.url) : undefined;
            return (
              <li key={m.id} className={`material${m.tipo === "lab" && m.feito ? " done" : ""}`}>
                <span className={`material-icon tone-${t.tone}`}>
                  <Icon name={t.icon} size={18} />
                </span>
                <span className="material-text">
                  {url ? (
                    <a href={url} target="_blank" rel="noopener noreferrer" className="material-title">
                      {m.titulo}
                      <Icon name="external" size={13} />
                    </a>
                  ) : (
                    <span className="material-title">{m.titulo}</span>
                  )}
                  <small className="muted">
                    {t.label}
                    {url ? ` · ${new URL(url).hostname}` : ""}
                  </small>
                </span>
                {m.tipo === "lab" && (
                  <label className="module-check" title={m.feito ? "Lab feito" : "Marcar lab como feito"}>
                    <input type="checkbox" checked={m.feito} onChange={() => void toggleFeito(m)} />
                    <span className="checkbox" aria-hidden="true">
                      {m.feito && <Icon name="check" size={14} />}
                    </span>
                    <span className="sr-only">Lab feito</span>
                  </label>
                )}
                <span className="module-actions">
                  <button
                    type="button"
                    className="icon-btn icon-btn-xs"
                    onClick={() => setModal({ mode: "edit", m })}
                    aria-label={`Editar ${m.titulo}`}
                    title="Editar"
                  >
                    <Icon name="edit" size={14} />
                  </button>
                  <button
                    type="button"
                    className="icon-btn icon-btn-xs icon-btn-danger"
                    onClick={() => setDeleting(m)}
                    aria-label={`Apagar ${m.titulo}`}
                    title="Apagar"
                  >
                    <Icon name="trash" size={14} />
                  </button>
                </span>
              </li>
            );
          })}
        </ul>
      )}

      <Dialog
        open={modal !== null}
        title={modal?.mode === "edit" ? "Editar material" : "Novo material"}
        onClose={() => !busy && setModal(null)}
      >
        {modal && (
          <MaterialForm
            key={modal.mode === "edit" ? modal.m.id : "new"}
            initial={modal.mode === "edit" ? modal.m : { tipo: "link", titulo: "", url: "" }}
            busy={busy}
            onCancel={() => setModal(null)}
            onSave={(input) => void save(input)}
          />
        )}
      </Dialog>

      <ConfirmDialog
        open={deleting !== null}
        title="Apagar material?"
        message={
          <p>
            <strong>{deleting?.titulo}</strong> será apagado.
          </p>
        }
        confirmLabel="Apagar"
        busy={busy}
        onConfirm={() => void doDelete()}
        onClose={() => !busy && setDeleting(null)}
      />
    </section>
  );
}

function MaterialForm({
  initial,
  busy,
  onSave,
  onCancel,
}: {
  initial: MaterialInput;
  busy: boolean;
  onSave: (input: MaterialInput) => void;
  onCancel: () => void;
}) {
  const [f, setF] = useState<MaterialInput>({ tipo: initial.tipo, titulo: initial.titulo, url: initial.url });
  const [errors, setErrors] = useState<Partial<Record<keyof MaterialInput, string>>>({});

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const r = validateMaterial(f);
    setErrors(r.errors);
    if (r.value) onSave(r.value);
  };

  return (
    <form className="form" onSubmit={submit} noValidate>
      <fieldset className="field">
        <legend>Tipo</legend>
        <div className="type-picker">
          {(Object.keys(MATERIAL_TIPOS) as MaterialTipo[]).map((k) => {
            const t = MATERIAL_TIPOS[k];
            return (
              <label key={k} className={`type-option tone-${t.tone}${f.tipo === k ? " active" : ""}`}>
                <input
                  type="radio"
                  name="mat-tipo"
                  value={k}
                  checked={f.tipo === k}
                  onChange={() => setF((x) => ({ ...x, tipo: k }))}
                />
                <Icon name={t.icon} size={18} />
                <span>{t.label}</span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className="field">
        <label htmlFor="mat-titulo">Título</label>
        <input
          id="mat-titulo"
          className="input"
          value={f.titulo}
          onChange={(e) => setF((x) => ({ ...x, titulo: e.target.value }))}
          maxLength={150}
          placeholder={f.tipo === "lab" ? "Ex.: Criar uma VPC com 2 subnets" : "Ex.: Guia oficial do exame"}
          aria-invalid={errors.titulo ? true : undefined}
        />
        {errors.titulo && <p className="field-error">{errors.titulo}</p>}
      </div>

      <div className="field">
        <label htmlFor="mat-url">
          Link {f.tipo === "lab" && <span className="muted">(opcional)</span>}
        </label>
        <input
          id="mat-url"
          className="input"
          type="url"
          inputMode="url"
          value={f.url}
          onChange={(e) => setF((x) => ({ ...x, url: e.target.value }))}
          placeholder="https://"
          aria-invalid={errors.url ? true : undefined}
        />
        {errors.url && <p className="field-error">{errors.url}</p>}
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
