// Formulários de certificação: dados gerais (com domínios e validade) e dados da prova.

import { useState, type FormEvent } from "react";
import type { Area } from "../data/areas";
import {
  CERT_STATUS,
  EMISSORES,
  pesoTotal,
  validateCert,
  validateProva,
  type CertErrors,
  type CertInput,
  type CertStatus,
  type Dominio,
  type Prova,
} from "../data/certs";
import { addYears } from "../data/dates";
import { newId } from "../data/validate";
import { Icon } from "./Icon";

export function toNum(v: string): number | null {
  if (v.trim() === "") return null;
  const n = Number(v.replace(",", "."));
  return Number.isFinite(n) ? n : NaN;
}

const numStr = (n: number | null) => (n === null ? "" : String(n));

export function CertForm({
  initial,
  areas,
  busy,
  onSave,
  onCancel,
}: {
  initial: CertInput;
  areas: Area[];
  busy: boolean;
  onSave: (input: CertInput) => void;
  onCancel: () => void;
}) {
  const [f, setF] = useState<CertInput>(initial);
  const [pesos, setPesos] = useState<string[]>(initial.dominios.map((d) => numStr(d.peso)));
  const [errors, setErrors] = useState<CertErrors>({});
  const set = <K extends keyof CertInput>(k: K, v: CertInput[K]) => setF((x) => ({ ...x, [k]: v }));

  const dominios: Dominio[] = f.dominios.map((d, i) => ({ ...d, peso: toNum(pesos[i] ?? "") ?? 0 }));
  const total = pesoTotal(dominios);

  const setDom = (i: number, nome: string) =>
    set(
      "dominios",
      f.dominios.map((d, j) => (j === i ? { ...d, nome } : d)),
    );
  const addDom = () => {
    set("dominios", [...f.dominios, { id: newId(), nome: "", peso: 0 }]);
    setPesos((p) => [...p, ""]);
  };
  const removeDom = (i: number) => {
    set(
      "dominios",
      f.dominios.filter((_, j) => j !== i),
    );
    setPesos((p) => p.filter((_, j) => j !== i));
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const r = validateCert({ ...f, dominios }, new Set(areas.map((a) => a.id)));
    setErrors(r.errors);
    if (r.value) onSave(r.value);
  };

  return (
    <form className="form" onSubmit={submit} noValidate>
      <div className="field">
        <label htmlFor="cert-nome">Nome da certificação</label>
        <input
          id="cert-nome"
          className="input"
          value={f.nome}
          onChange={(e) => set("nome", e.target.value)}
          maxLength={120}
          placeholder="Ex.: AWS Certified Cloud Practitioner"
          autoFocus
          aria-invalid={errors.nome ? true : undefined}
        />
        {errors.nome && <p className="field-error">{errors.nome}</p>}
      </div>

      <div className="form-row">
        <div className="field">
          <label htmlFor="cert-codigo">
            Código <span className="muted">(opcional)</span>
          </label>
          <input
            id="cert-codigo"
            className="input"
            value={f.codigo}
            onChange={(e) => set("codigo", e.target.value)}
            maxLength={30}
            placeholder="Ex.: CLF-C02"
          />
          {errors.codigo && <p className="field-error">{errors.codigo}</p>}
        </div>
        <div className="field">
          <label htmlFor="cert-emissor">
            Emissor <span className="muted">(opcional)</span>
          </label>
          <input
            id="cert-emissor"
            className="input"
            list="emissores"
            value={f.emissor}
            onChange={(e) => set("emissor", e.target.value)}
            maxLength={60}
            placeholder="Ex.: AWS"
          />
          <datalist id="emissores">
            {EMISSORES.map((x) => (
              <option key={x} value={x} />
            ))}
          </datalist>
        </div>
      </div>

      <div className="form-row">
        <div className="field">
          <label htmlFor="cert-area">Área</label>
          <select id="cert-area" className="input" value={f.areaId} onChange={(e) => set("areaId", e.target.value)}>
            <option value="">Sem área</option>
            {areas.map((a) => (
              <option key={a.id} value={a.id}>
                {a.nome}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="cert-status">Status</label>
          <select
            id="cert-status"
            className="input"
            value={f.status}
            onChange={(e) => set("status", e.target.value as CertStatus)}
          >
            {Object.entries(CERT_STATUS).map(([k, v]) => (
              <option key={k} value={k}>
                {v.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <fieldset className="field">
        <legend>Domínios do exame</legend>
        {f.dominios.length === 0 && (
          <p className="muted small">Adicione os domínios do guia do exame para registrar a nota de cada um nos simulados.</p>
        )}
        <div className="dom-list">
          {f.dominios.map((d, i) => (
            <div key={d.id} className="dom-row">
              <input
                className="input"
                value={d.nome}
                onChange={(e) => setDom(i, e.target.value)}
                maxLength={80}
                placeholder={`Domínio ${i + 1}`}
                aria-label={`Nome do domínio ${i + 1}`}
              />
              <div className="input-suffix">
                <input
                  className="input"
                  inputMode="decimal"
                  value={pesos[i] ?? ""}
                  onChange={(e) => setPesos((p) => p.map((x, j) => (j === i ? e.target.value : x)))}
                  placeholder="Peso"
                  aria-label={`Peso do domínio ${i + 1} em %`}
                />
                <span aria-hidden="true">%</span>
              </div>
              <button
                type="button"
                className="icon-btn icon-btn-sm icon-btn-danger"
                onClick={() => removeDom(i)}
                aria-label={`Remover domínio ${i + 1}`}
              >
                <Icon name="close" size={16} />
              </button>
            </div>
          ))}
        </div>
        <div className="dom-foot">
          <button type="button" className="btn btn-ghost btn-sm" onClick={addDom}>
            <Icon name="plus" size={16} />
            Adicionar domínio
          </button>
          {f.dominios.length > 0 && (
            <span className={`small ${total === 100 ? "text-green" : "text-amber"}`}>
              Soma dos pesos: {total}%{total !== 100 && " (o ideal é 100%)"}
            </span>
          )}
        </div>
        {errors.dominiosLista && <p className="field-error">{errors.dominiosLista}</p>}
      </fieldset>

      <div className="field">
        <label htmlFor="cert-cred">
          Link da credencial <span className="muted">(Credly ou certificado)</span>
        </label>
        <input
          id="cert-cred"
          className="input"
          type="url"
          inputMode="url"
          value={f.credencialUrl}
          onChange={(e) => set("credencialUrl", e.target.value)}
          placeholder="https://www.credly.com/badges/…"
          aria-invalid={errors.credencialUrl ? true : undefined}
        />
        {errors.credencialUrl && <p className="field-error">{errors.credencialUrl}</p>}
      </div>

      <div className="form-row">
        <div className="field">
          <label htmlFor="cert-emitida">Emitida em</label>
          <input
            id="cert-emitida"
            className="input"
            type="date"
            value={f.emitidaEm}
            onChange={(e) => set("emitidaEm", e.target.value)}
          />
          {errors.emitidaEm && <p className="field-error">{errors.emitidaEm}</p>}
        </div>
        <div className="field">
          <label htmlFor="cert-expira">Válida até</label>
          <input
            id="cert-expira"
            className="input"
            type="date"
            value={f.expiraEm}
            onChange={(e) => set("expiraEm", e.target.value)}
          />
          {errors.expiraEm && <p className="field-error">{errors.expiraEm}</p>}
        </div>
      </div>
      {f.emitidaEm && (
        <div className="quick-fill">
          <span className="muted small">Preencher validade:</span>
          {[2, 3].map((y) => (
            <button key={y} type="button" className="chip" onClick={() => set("expiraEm", addYears(f.emitidaEm, y))}>
              +{y} anos
            </button>
          ))}
        </div>
      )}

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

export function ProvaForm({
  initial,
  busy,
  onSave,
  onCancel,
}: {
  initial: Prova;
  busy: boolean;
  onSave: (p: Prova) => void;
  onCancel: () => void;
}) {
  const [p, setP] = useState<Prova>(initial);
  const [nums, setNums] = useState({
    nota: numStr(initial.nota),
    notaMinima: numStr(initial.notaMinima),
    notaMaxima: numStr(initial.notaMaxima),
  });
  const [errors, setErrors] = useState<Partial<Record<keyof Prova, string>>>({});
  const set = <K extends keyof Prova>(k: K, v: Prova[K]) => setP((x) => ({ ...x, [k]: v }));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const r = validateProva({
      ...p,
      nota: toNum(nums.nota),
      notaMinima: toNum(nums.notaMinima),
      notaMaxima: toNum(nums.notaMaxima),
    });
    setErrors(r.errors);
    if (r.value) onSave(r.value);
  };

  return (
    <form className="form" onSubmit={submit} noValidate>
      <div className="form-row">
        <div className="field">
          <label htmlFor="prova-data">Data da prova</label>
          <input id="prova-data" className="input" type="date" value={p.data} onChange={(e) => set("data", e.target.value)} />
          {errors.data && <p className="field-error">{errors.data}</p>}
        </div>
        <div className="field">
          <label htmlFor="prova-hora">Horário</label>
          <input id="prova-hora" className="input" type="time" value={p.hora} onChange={(e) => set("hora", e.target.value)} />
          {errors.hora && <p className="field-error">{errors.hora}</p>}
        </div>
      </div>

      <div className="form-row">
        <div className="field">
          <label htmlFor="prova-mod">Modalidade</label>
          <select
            id="prova-mod"
            className="input"
            value={p.modalidade}
            onChange={(e) => set("modalidade", e.target.value as Prova["modalidade"])}
          >
            <option value="">Não definida</option>
            <option value="online">Online</option>
            <option value="presencial">Presencial</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="prova-local">Local / plataforma</label>
          <input
            id="prova-local"
            className="input"
            value={p.local}
            onChange={(e) => set("local", e.target.value)}
            maxLength={120}
            placeholder="Ex.: Pearson VUE"
          />
          {errors.local && <p className="field-error">{errors.local}</p>}
        </div>
      </div>

      <div className="form-row">
        <div className="field">
          <label htmlFor="prova-voucher">Voucher</label>
          <input
            id="prova-voucher"
            className="input"
            value={p.voucher}
            onChange={(e) => set("voucher", e.target.value)}
            maxLength={60}
            placeholder="Código ou observação"
            autoComplete="off"
          />
          {errors.voucher && <p className="field-error">{errors.voucher}</p>}
        </div>
        <div className="field">
          <label htmlFor="prova-vval">Voucher válido até</label>
          <input
            id="prova-vval"
            className="input"
            type="date"
            value={p.voucherValidade}
            onChange={(e) => set("voucherValidade", e.target.value)}
          />
          {errors.voucherValidade && <p className="field-error">{errors.voucherValidade}</p>}
        </div>
      </div>

      <div className="form-row form-row-3">
        {(
          [
            ["nota", "Nota obtida", "Ex.: 812"],
            ["notaMinima", "Nota mínima", "Ex.: 700"],
            ["notaMaxima", "Nota máxima", "Ex.: 1000"],
          ] as const
        ).map(([k, label, ph]) => (
          <div className="field" key={k}>
            <label htmlFor={`prova-${k}`}>{label}</label>
            <input
              id={`prova-${k}`}
              className="input"
              inputMode="decimal"
              value={nums[k]}
              onChange={(e) => setNums((x) => ({ ...x, [k]: e.target.value }))}
              placeholder={ph}
            />
            {errors[k] && <p className="field-error">{errors[k]}</p>}
          </div>
        ))}
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
