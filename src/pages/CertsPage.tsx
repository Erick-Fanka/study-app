import { useState } from "react";
import { friendlyError } from "../data/store";
import { useCatalog } from "../data/CatalogContext";
import { CERT_STATUS, validadeInfo, type Cert, type CertInput } from "../data/certs";
import { daysUntil, fmtDate, relDays } from "../data/dates";
import { href } from "../router";
import { Icon } from "../components/Icon";
import { Dialog } from "../components/Dialog";
import { useToast } from "../components/Toast";
import { CertForm } from "../components/CertForms";

export function CertsPage() {
  const cat = useCatalog();
  const toast = useToast();
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);

  const certs = cat.certs;
  const areas = cat.areas ?? [];

  const create = async (input: CertInput) => {
    setBusy(true);
    try {
      const cert = await cat.createCert(input);
      toast.success(`Certificação “${cert.nome}” criada.`);
      setCreating(false);
      window.location.hash = `#/certificacoes/${cert.id}`;
    } catch (e) {
      toast.error(friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="stack">
      <header className="page-head page-head-row">
        <div>
          <p className="eyebrow">Conquistas</p>
          <h1>Certificações</h1>
          <p className="muted">Provas, validade, domínios e a evolução nos simulados.</p>
        </div>
        {certs && certs.length > 0 && (
          <div className="head-actions">
            <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}>
              <Icon name="plus" size={18} />
              Nova certificação
            </button>
          </div>
        )}
      </header>

      {cat.error != null && !certs && (
        <div className="card">
          <div className="alert" role="alert">
            <Icon name="alert" size={18} />
            <span>{friendlyError(cat.error)}</span>
          </div>
          <button type="button" className="btn btn-ghost" onClick={() => void cat.reload()}>
            <Icon name="refresh" size={18} />
            Tentar de novo
          </button>
        </div>
      )}

      {!certs && !cat.error && (
        <div className="course-grid" aria-busy="true">
          {[0, 1].map((i) => (
            <div key={i} className="course-card skeleton" />
          ))}
        </div>
      )}

      {certs && certs.length === 0 && (
        <section className="empty">
          <span className="empty-icon tone-green">
            <Icon name="award" size={30} />
          </span>
          <h2>Nenhuma certificação ainda</h2>
          <p className="muted">
            Cadastre suas certificações com os domínios do exame para acompanhar prova, validade e simulados.
          </p>
          <div className="head-actions center">
            <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}>
              <Icon name="plus" size={18} />
              Nova certificação
            </button>
          </div>
        </section>
      )}

      {certs && certs.length > 0 && (
        <div className="course-grid">
          {certs.map((c) => (
            <CertCard key={c.id} cert={c} areaNome={areas.find((a) => a.id === c.areaId)?.nome} />
          ))}
        </div>
      )}

      <Dialog open={creating} title="Nova certificação" onClose={() => !busy && setCreating(false)}>
        {creating && (
          <CertForm
            initial={{
              areaId: "",
              nome: "",
              codigo: "",
              emissor: "",
              status: "estudando",
              dominios: [],
              credencialUrl: "",
              emitidaEm: "",
              expiraEm: "",
            }}
            areas={areas}
            busy={busy}
            onCancel={() => setCreating(false)}
            onSave={(input) => void create(input)}
          />
        )}
      </Dialog>

    </div>
  );
}

function CertCard({ cert, areaNome }: { cert: Cert; areaNome?: string }) {
  const s = CERT_STATUS[cert.status];
  const val = validadeInfo(cert);
  const provaDias = cert.prova.data ? daysUntil(cert.prova.data) : null;
  return (
    <a className={`course-card cert-card tone-${s.tone}`} href={href(`/certificacoes/${cert.id}`)}>
      <div className="course-card-top">
        <span className={`tag tone-${s.tone}`}>{s.label}</span>
        {cert.codigo && <span className="cert-code">{cert.codigo}</span>}
      </div>
      <h3 className="course-title">{cert.nome}</h3>
      <p className="muted small">{[cert.emissor, areaNome].filter(Boolean).join(" · ") || "Sem área"}</p>
      <div className="cert-card-foot">
        {cert.status === "agendada" && provaDias !== null && provaDias >= 0 && (
          <span className="tag tone-orange">
            <Icon name="calendar" size={13} />
            Prova {relDays(provaDias)}
          </span>
        )}
        {val && (
          <span className={`tag tone-${val.nivel === "ok" ? "ink" : val.nivel === "aviso" ? "amber" : "red"}`}>
            <Icon name="shield" size={13} />
            {val.nivel === "vencida" ? `Venceu em ${fmtDate(cert.expiraEm)}` : `Válida até ${fmtDate(cert.expiraEm)}`}
          </span>
        )}
        {cert.dominios.length > 0 && (
          <span className="muted small">{cert.dominios.length} domínios</span>
        )}
      </div>
    </a>
  );
}
