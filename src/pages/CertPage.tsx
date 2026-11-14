import { useEffect, useMemo, useState } from "react";
import { useServices } from "../services";
import { friendlyError } from "../data/store";
import { useCatalog } from "../data/CatalogContext";
import { CERT_STATUS, validadeInfo, type Cert, type CertInput, type Prova } from "../data/certs";
import {
  createSimulado,
  deleteSimulado,
  listSimulados,
  pctGeral,
  sortSimulados,
  updateSimulado,
  type Simulado,
  type SimuladoInput,
} from "../data/simulados";
import { daysUntil, fmtDate, relDays } from "../data/dates";
import { safeHref } from "../data/validate";
import { href } from "../router";
import { Icon } from "../components/Icon";
import { ConfirmDialog, Dialog } from "../components/Dialog";
import { useToast } from "../components/Toast";
import { CertForm, ProvaForm } from "../components/CertForms";
import { SimuladoForm, SimuladosTable } from "../components/Simulados";
import { MaterialsCard } from "../components/MaterialsCard";
import { EvolucaoChart } from "../components/EvolucaoChart";

type SimModal = { mode: "create" } | { mode: "edit"; s: Simulado } | null;

export function CertPage({ id }: { id: string }) {
  const cat = useCatalog();
  const toast = useToast();
  const [editing, setEditing] = useState<"cert" | "prova" | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  const cert = cat.certs?.find((c) => c.id === id);
  const area = cert?.areaId ? cat.areas?.find((a) => a.id === cert.areaId) : undefined;

  if (!cat.certs || !cat.areas) {
    return (
      <div className="stack" aria-busy="true">
        <div className="card skeleton detail-skeleton" />
      </div>
    );
  }

  if (!cert) {
    return (
      <section className="empty">
        <span className="empty-icon tone-ink">
          <Icon name="alert" size={30} />
        </span>
        <h1>Certificação não encontrada</h1>
        <p className="muted">Ela pode ter sido apagada.</p>
        <a className="btn btn-primary" href={href("/certificacoes")}>
          <Icon name="arrowLeft" size={18} />
          Voltar para Certificações
        </a>
      </section>
    );
  }

  const s = CERT_STATUS[cert.status];
  const cred = cert.credencialUrl ? safeHref(cert.credencialUrl) : undefined;
  const val = validadeInfo(cert);

  const run = async (job: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try {
      await job();
      toast.success(ok);
      setEditing(null);
    } catch (e) {
      toast.error(friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  const doDelete = async () => {
    setBusy(true);
    try {
      await cat.deleteCert(cert.id);
      toast.success(`Certificação “${cert.nome}” apagada.`);
      window.location.hash = "#/certificacoes";
    } catch (e) {
      toast.error(friendlyError(e));
      setBusy(false);
    }
  };

  return (
    <div className="stack detail">
      <a className="back-link" href={href("/certificacoes")}>
        <Icon name="arrowLeft" size={16} />
        Certificações
      </a>

      <section className={`card course-hero tone-${s.tone}`}>
        <div className="course-hero-main">
          <div className="course-hero-tags">
            {area && (
              <span className="tag area-tag">
                <span className={`chip-dot tone-${area.cor}`} aria-hidden="true" />
                {area.nome}
              </span>
            )}
            <span className={`tag tone-${s.tone}`}>{s.label}</span>
            {cert.codigo && <span className="cert-code">{cert.codigo}</span>}
          </div>
          <h1>{cert.nome}</h1>
          {cert.emissor && <p className="muted">{cert.emissor}</p>}
          <div className="course-hero-actions">
            {cred && (
              <a className="btn btn-primary" href={cred} target="_blank" rel="noopener noreferrer">
                Ver credencial
                <Icon name="external" size={16} />
              </a>
            )}
            <button type="button" className="btn btn-ghost" onClick={() => setEditing("cert")}>
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
          <span className="eyebrow">Validade</span>
          {val ? (
            <>
              <strong className={`validade validade-${val.nivel}`}>
                {val.nivel === "vencida" ? "Vencida" : `Até ${fmtDate(cert.expiraEm)}`}
              </strong>
              <p className="muted small">
                {val.nivel === "vencida"
                  ? `Venceu ${relDays(val.dias)}.`
                  : val.nivel === "aviso"
                    ? `Vence ${relDays(val.dias)}. Planeje a renovação.`
                    : `Vence ${relDays(val.dias)}.`}
              </p>
            </>
          ) : (
            <p className="muted small">
              {cert.status === "aprovada" ? "Cadastre a data de validade em “Editar”." : "Definida após a aprovação."}
            </p>
          )}
          {cert.emitidaEm && <p className="muted small">Emitida em {fmtDate(cert.emitidaEm)}</p>}
        </div>
      </section>

      <SimuladosCard cert={cert} />

      <div className="detail-grid">
        <ProvaCard cert={cert} onEdit={() => setEditing("prova")} />
        <MaterialsCard parentId={cert.id} />
      </div>

      <Dialog open={editing === "cert"} title="Editar certificação" onClose={() => !busy && setEditing(null)}>
        {editing === "cert" && (
          <CertForm
            initial={certInput(cert)}
            areas={cat.areas}
            busy={busy}
            onCancel={() => setEditing(null)}
            onSave={(input) => void run(() => cat.updateCert(cert.id, input), "Certificação atualizada.")}
          />
        )}
      </Dialog>

      <Dialog open={editing === "prova"} title="Dados da prova" onClose={() => !busy && setEditing(null)}>
        {editing === "prova" && (
          <ProvaForm
            initial={cert.prova}
            busy={busy}
            onCancel={() => setEditing(null)}
            onSave={(p: Prova) => void run(() => cat.updateProva(cert.id, p), "Dados da prova salvos.")}
          />
        )}
      </Dialog>

      <ConfirmDialog
        open={confirmDelete}
        title="Apagar certificação?"
        message={
          <p>
            <strong>{cert.nome}</strong>, seus simulados e materiais serão apagados. Essa ação não pode ser desfeita.
          </p>
        }
        confirmLabel="Apagar certificação"
        busy={busy}
        onConfirm={() => void doDelete()}
        onClose={() => !busy && setConfirmDelete(false)}
      />
    </div>
  );
}

function certInput(c: Cert): CertInput {
  return {
    areaId: c.areaId,
    nome: c.nome,
    codigo: c.codigo,
    emissor: c.emissor,
    status: c.status,
    dominios: c.dominios,
    credencialUrl: c.credencialUrl,
    emitidaEm: c.emitidaEm,
    expiraEm: c.expiraEm,
  };
}

/* ---------------- Prova ---------------- */

function ProvaCard({ cert, onEdit }: { cert: Cert; onEdit: () => void }) {
  const p = cert.prova;
  const dias = p.data ? daysUntil(p.data) : null;
  const vazio = !p.data && !p.modalidade && !p.local && !p.voucher && p.nota === null;
  const notaTxt =
    p.nota === null
      ? ""
      : `${p.nota}${p.notaMaxima ? ` / ${p.notaMaxima}` : ""}${p.notaMinima ? ` (mínimo ${p.notaMinima})` : ""}`;
  const aprovadoPelaNota = p.nota !== null && p.notaMinima !== null ? p.nota >= p.notaMinima : null;

  return (
    <section className="card">
      <div className="card-head">
        <h2>Prova</h2>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onEdit}>
          <Icon name="edit" size={16} />
          {vazio ? "Adicionar" : "Editar"}
        </button>
      </div>
      {vazio ? (
        <p className="muted">Registre a data, a modalidade, o voucher e a nota da prova.</p>
      ) : (
        <dl className="kv">
          {p.data && (
            <>
              <dt>Data</dt>
              <dd>
                {fmtDate(p.data)}
                {p.hora && ` às ${p.hora}`}
                {dias !== null && dias >= 0 && cert.status !== "aprovada" && (
                  <span className="tag tone-orange tag-inline">{relDays(dias)}</span>
                )}
              </dd>
            </>
          )}
          {p.modalidade && (
            <>
              <dt>Modalidade</dt>
              <dd>{p.modalidade === "online" ? "Online" : "Presencial"}</dd>
            </>
          )}
          {p.local && (
            <>
              <dt>Local</dt>
              <dd>{p.local}</dd>
            </>
          )}
          {p.voucher && (
            <>
              <dt>Voucher</dt>
              <dd>
                <code className="break">{p.voucher}</code>
              </dd>
            </>
          )}
          {p.voucherValidade && (
            <>
              <dt>Voucher vale até</dt>
              <dd>
                {fmtDate(p.voucherValidade)}
                {daysUntil(p.voucherValidade) >= 0 && daysUntil(p.voucherValidade) <= 30 && (
                  <span className="tag tone-amber tag-inline">vence {relDays(daysUntil(p.voucherValidade))}</span>
                )}
              </dd>
            </>
          )}
          {notaTxt && (
            <>
              <dt>Nota</dt>
              <dd>
                <strong>{notaTxt}</strong>
                {aprovadoPelaNota !== null && (
                  <span className={`tag tag-inline tone-${aprovadoPelaNota ? "green" : "red"}`}>
                    {aprovadoPelaNota ? "aprovado" : "abaixo do mínimo"}
                  </span>
                )}
              </dd>
            </>
          )}
        </dl>
      )}
    </section>
  );
}

/* ---------------- Simulados ---------------- */

function SimuladosCard({ cert }: { cert: Cert }) {
  const { db } = useServices();
  const toast = useToast();
  const [list, setList] = useState<Simulado[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<SimModal>(null);
  const [confirmDel, setConfirmDel] = useState<Simulado | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    listSimulados(db, cert.id)
      .then((l) => active && setList(l))
      .catch((e) => active && setError(friendlyError(e)));
    return () => {
      active = false;
    };
  }, [db, cert.id]);

  const fontes = useMemo(() => (list ?? []).map((s) => s.fonte).filter(Boolean), [list]);
  const ultimo = list && list.length ? list[list.length - 1] : null;
  const ultimoGeral = ultimo ? pctGeral(ultimo) : null;

  const save = async (input: SimuladoInput) => {
    setBusy(true);
    try {
      if (modal?.mode === "edit") {
        const s = await updateSimulado(db, modal.s, input);
        setList((l) => sortSimulados((l ?? []).map((x) => (x.id === s.id ? s : x))));
        toast.success("Simulado atualizado.");
      } else {
        const s = await createSimulado(db, cert.id, input);
        setList((l) => sortSimulados([...(l ?? []), s]));
        toast.success("Simulado registrado.");
      }
      setModal(null);
    } catch (e) {
      toast.error(friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  const doDelete = async () => {
    if (!confirmDel) return;
    setBusy(true);
    try {
      await deleteSimulado(db, confirmDel);
      setList((l) => (l ?? []).filter((x) => x.id !== confirmDel.id));
      toast.success("Simulado apagado.");
      setConfirmDel(null);
      setModal(null);
    } catch (e) {
      toast.error(friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card">
      <div className="card-head">
        <h2>
          Simulados <span className="muted count-inline">{list?.length ?? ""}</span>
        </h2>
        <button type="button" className="btn btn-primary btn-sm" onClick={() => setModal({ mode: "create" })}>
          <Icon name="plus" size={16} />
          Novo simulado
        </button>
      </div>

      {error && <p className="field-error">{error}</p>}
      {!error && list === null && <p className="muted">Carregando…</p>}
      {list && list.length === 0 && (
        <p className="muted">
          Registre cada simulado com a nota de cada domínio para ver onde você está mais forte e mais fraco.
          {cert.dominios.length === 0 && " Antes, cadastre os domínios em “Editar”."}
        </p>
      )}
      {list && list.length > 0 && (
        <>
          {ultimoGeral !== null && (
            <p className="muted small sim-last">
              Último simulado ({fmtDate(ultimo!.data)}): <strong>{ultimoGeral}%</strong> no geral
            </p>
          )}
          <div className="sim-views">
            <div>
              <h3 className="sim-view-title">Evolução</h3>
              <EvolucaoChart dominios={cert.dominios} simulados={list} />
            </div>
            <div>
              <h3 className="sim-view-title">Tabela</h3>
              <SimuladosTable
                dominios={cert.dominios}
                simulados={list}
                onEdit={(s) => setModal({ mode: "edit", s })}
              />
            </div>
          </div>
        </>
      )}

      <Dialog
        open={modal !== null}
        title={modal?.mode === "edit" ? "Editar simulado" : "Novo simulado"}
        onClose={() => !busy && setModal(null)}
      >
        {modal && (
          <SimuladoForm
            key={modal.mode === "edit" ? modal.s.id : "new"}
            initial={modal.mode === "edit" ? modal.s : null}
            dominios={cert.dominios}
            fontes={fontes}
            busy={busy}
            onCancel={() => setModal(null)}
            onSave={(input) => void save(input)}
            onDelete={modal.mode === "edit" ? () => setConfirmDel(modal.s) : undefined}
          />
        )}
      </Dialog>

      <ConfirmDialog
        open={confirmDel !== null}
        title="Apagar simulado?"
        message={<p>O simulado de {confirmDel ? fmtDate(confirmDel.data) : ""} será apagado.</p>}
        confirmLabel="Apagar simulado"
        busy={busy}
        onConfirm={() => void doDelete()}
        onClose={() => !busy && setConfirmDel(null)}
      />
    </section>
  );
}
