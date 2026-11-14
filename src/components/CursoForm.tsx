import { useState, type FormEvent } from "react";
import type { Area } from "../data/areas";
import {
  MAX_MODULOS,
  PLATAFORMAS,
  PRIORIDADE,
  STATUS,
  parseModuleLines,
  validateCurso,
  type CursoErrors,
  type CursoInput,
  type CursoStatus,
  type Prioridade,
} from "../data/cursos";

export function CursoForm({
  initial,
  areas,
  withModules,
  busy,
  onSave,
  onCancel,
}: {
  initial: CursoInput;
  areas: Area[];
  /** No cadastro novo, permite colar a lista de módulos. */
  withModules: boolean;
  busy: boolean;
  onSave: (input: CursoInput, modulos: string[]) => void;
  onCancel: () => void;
}) {
  const [f, setF] = useState<CursoInput>(initial);
  const [modulosText, setModulosText] = useState("");
  const [errors, setErrors] = useState<CursoErrors>({});
  const set = <K extends keyof CursoInput>(k: K, v: CursoInput[K]) => setF((x) => ({ ...x, [k]: v }));

  const parsed = parseModuleLines(modulosText);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const result = validateCurso(f, new Set(areas.map((a) => a.id)));
    const errs: CursoErrors = { ...result.errors };
    if (withModules && parsed.error) errs.modulos = parsed.error;
    if (withModules && parsed.titulos.length > MAX_MODULOS) errs.modulos = `No máximo ${MAX_MODULOS} módulos.`;
    setErrors(errs);
    if (result.value && !errs.modulos) onSave(result.value, withModules ? parsed.titulos : []);
  };

  return (
    <form className="form" onSubmit={submit} noValidate>
      <div className="field">
        <label htmlFor="curso-nome">Nome do curso</label>
        <input
          id="curso-nome"
          className="input"
          value={f.nome}
          onChange={(e) => set("nome", e.target.value)}
          maxLength={120}
          placeholder="Ex.: CCNA: Introdução às Redes"
          autoFocus
          aria-invalid={errors.nome ? true : undefined}
        />
        {errors.nome && <p className="field-error">{errors.nome}</p>}
      </div>

      <div className="form-row">
        <div className="field">
          <label htmlFor="curso-area">Área</label>
          <select
            id="curso-area"
            className="input"
            value={f.areaId}
            onChange={(e) => set("areaId", e.target.value)}
            aria-invalid={errors.areaId ? true : undefined}
          >
            <option value="" disabled>
              Escolha…
            </option>
            {areas.map((a) => (
              <option key={a.id} value={a.id}>
                {a.nome}
              </option>
            ))}
          </select>
          {errors.areaId && <p className="field-error">{errors.areaId}</p>}
        </div>

        <div className="field">
          <label htmlFor="curso-plataforma">
            Plataforma <span className="muted">(opcional)</span>
          </label>
          <input
            id="curso-plataforma"
            className="input"
            list="plataformas"
            value={f.plataforma}
            onChange={(e) => set("plataforma", e.target.value)}
            maxLength={60}
            placeholder="Ex.: Udemy"
          />
          <datalist id="plataformas">
            {PLATAFORMAS.map((p) => (
              <option key={p} value={p} />
            ))}
          </datalist>
          {errors.plataforma && <p className="field-error">{errors.plataforma}</p>}
        </div>
      </div>

      <div className="field">
        <label htmlFor="curso-url">
          Link do curso <span className="muted">(opcional)</span>
        </label>
        <input
          id="curso-url"
          className="input"
          type="url"
          inputMode="url"
          value={f.url}
          onChange={(e) => set("url", e.target.value)}
          placeholder="https://"
          aria-invalid={errors.url ? true : undefined}
        />
        {errors.url && <p className="field-error">{errors.url}</p>}
      </div>

      <div className="form-row">
        <div className="field">
          <label htmlFor="curso-status">Status</label>
          <select
            id="curso-status"
            className="input"
            value={f.status}
            onChange={(e) => set("status", e.target.value as CursoStatus)}
          >
            {Object.entries(STATUS).map(([k, v]) => (
              <option key={k} value={k}>
                {v.label}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="curso-prioridade">Prioridade</label>
          <select
            id="curso-prioridade"
            className="input"
            value={f.prioridade}
            onChange={(e) => set("prioridade", e.target.value as Prioridade)}
          >
            {Object.entries(PRIORIDADE).map(([k, v]) => (
              <option key={k} value={k}>
                {v.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="field">
        <label htmlFor="curso-desc">
          Descrição <span className="muted">(opcional)</span>
        </label>
        <textarea
          id="curso-desc"
          className="input"
          rows={2}
          value={f.descricao}
          onChange={(e) => set("descricao", e.target.value)}
          maxLength={500}
        />
        {errors.descricao && <p className="field-error">{errors.descricao}</p>}
      </div>

      {withModules && (
        <div className="field">
          <label htmlFor="curso-modulos">
            Módulos <span className="muted">(opcional, um por linha)</span>
          </label>
          <textarea
            id="curso-modulos"
            className="input mono"
            rows={5}
            value={modulosText}
            onChange={(e) => setModulosText(e.target.value)}
            placeholder={"Módulo 1: Fundamentos\nMódulo 2: Endereçamento IP\nMódulo 3: Switching"}
          />
          {errors.modulos ? (
            <p className="field-error">{errors.modulos}</p>
          ) : (
            <p className="muted small">
              {parsed.titulos.length > 0
                ? `${parsed.titulos.length} módulo(s) serão criados.`
                : "Você também pode adicionar módulos depois, na página do curso."}
            </p>
          )}
        </div>
      )}

      <div className="dialog-actions">
        <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={busy}>
          Cancelar
        </button>
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? "Salvando…" : "Salvar curso"}
        </button>
      </div>
    </form>
  );
}
