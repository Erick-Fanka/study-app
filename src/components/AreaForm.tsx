import { useState, type FormEvent } from "react";
import { AREA_COLORS, validateArea, type AreaColor, type AreaInput } from "../data/areas";
import { Icon } from "./Icon";

export function AreaForm({
  initial,
  busy,
  onSave,
  onCancel,
}: {
  initial: AreaInput;
  busy: boolean;
  onSave: (input: AreaInput) => void;
  onCancel: () => void;
}) {
  const [nome, setNome] = useState(initial.nome);
  const [descricao, setDescricao] = useState(initial.descricao);
  const [cor, setCor] = useState<AreaColor>(initial.cor);
  const [errors, setErrors] = useState<Partial<Record<keyof AreaInput, string>>>({});

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const result = validateArea({ nome, descricao, cor });
    setErrors(result.errors);
    if (result.value) onSave(result.value);
  };

  return (
    <form className="form" onSubmit={submit} noValidate>
      <div className="field">
        <label htmlFor="area-nome">Nome</label>
        <input
          id="area-nome"
          className="input"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          maxLength={60}
          placeholder="Ex.: Cloud"
          autoFocus
          aria-invalid={errors.nome ? true : undefined}
        />
        {errors.nome && <p className="field-error">{errors.nome}</p>}
      </div>

      <div className="field">
        <label htmlFor="area-desc">
          Descrição <span className="muted">(opcional)</span>
        </label>
        <textarea
          id="area-desc"
          className="input"
          rows={2}
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          maxLength={200}
          placeholder="Ex.: AWS, Azure e Google Cloud"
        />
        {errors.descricao && <p className="field-error">{errors.descricao}</p>}
      </div>

      <fieldset className="field">
        <legend>Cor</legend>
        <div className="swatches">
          {AREA_COLORS.map((c) => (
            <label key={c.id} className={`swatch tone-${c.id}`} title={c.label}>
              <input type="radio" name="area-cor" value={c.id} checked={cor === c.id} onChange={() => setCor(c.id)} />
              <span className="swatch-dot" aria-hidden="true">
                {cor === c.id && <Icon name="check" size={16} />}
              </span>
              <span className="sr-only">{c.label}</span>
            </label>
          ))}
        </div>
        {errors.cor && <p className="field-error">{errors.cor}</p>}
      </fieldset>

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
