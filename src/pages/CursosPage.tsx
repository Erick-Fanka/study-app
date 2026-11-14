import { useMemo, useState, type ReactNode } from "react";
import { friendlyError } from "../data/store";
import { AreaNotEmptyError, useCatalog } from "../data/CatalogContext";
import { newModulos, nextModule, progress, STATUS, type Curso, type CursoInput, type CursoStatus } from "../data/cursos";
import type { Area, AreaInput } from "../data/areas";
import { href } from "../router";
import { Icon } from "../components/Icon";
import { ConfirmDialog, Dialog } from "../components/Dialog";
import { useToast } from "../components/Toast";
import { AreaForm } from "../components/AreaForm";
import { CursoForm } from "../components/CursoForm";
import { ProgressBar, StatusBadge } from "../components/Bits";

const SUGGESTIONS: AreaInput[] = [
  { nome: "Cloud", descricao: "AWS, Azure e Google Cloud", cor: "orange" },
  { nome: "Redes", descricao: "Cisco, CCNA e fundamentos", cor: "blue" },
  { nome: "Segurança", descricao: "Cloudflare, pentest e boas práticas", cor: "green" },
];

type StatusFilter = "todos" | CursoStatus;

type Modal =
  | { kind: "newArea" }
  | { kind: "editArea"; area: Area }
  | { kind: "newCurso"; areaId: string }
  | null;

export function CursosPage() {
  const cat = useCatalog();
  const toast = useToast();
  const [modal, setModal] = useState<Modal>(null);
  const [deleting, setDeleting] = useState<Area | null>(null);
  const [busy, setBusy] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("todos");
  const [areaFilter, setAreaFilter] = useState<string>("todas");

  const areas = cat.areas;
  const cursos = cat.cursos;

  const counts = useMemo(() => {
    const c: Record<StatusFilter, number> = { todos: 0, planejado: 0, em_andamento: 0, pausado: 0, concluido: 0 };
    for (const x of cursos ?? []) {
      if (areaFilter !== "todas" && x.areaId !== areaFilter) continue;
      c.todos++;
      c[x.status]++;
    }
    return c;
  }, [cursos, areaFilter]);

  const run = async (job: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try {
      await job();
      toast.success(ok);
      return true;
    } catch (e) {
      toast.error(e instanceof AreaNotEmptyError ? e.message : friendlyError(e));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const saveArea = async (input: AreaInput) => {
    const ok =
      modal?.kind === "editArea"
        ? await run(() => cat.updateArea(modal.area.id, input), "Área atualizada.")
        : await run(() => cat.createArea(input), `Área “${input.nome}” criada.`);
    if (ok) setModal(null);
  };

  const saveCurso = async (input: CursoInput, titulos: string[]) => {
    const ok = await run(() => cat.createCurso(input, newModulos(titulos)), `Curso “${input.nome}” criado.`);
    if (ok) setModal(null);
  };

  const confirmDeleteArea = async () => {
    if (!deleting) return;
    const ok = await run(() => cat.deleteArea(deleting.id), `Área “${deleting.nome}” apagada.`);
    if (ok) setDeleting(null);
  };

  if (cat.error && !areas) {
    return (
      <div className="stack">
        <Header />
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
      </div>
    );
  }

  if (!areas || !cursos) {
    return (
      <div className="stack">
        <Header />
        <div className="course-grid" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="course-card skeleton" />
          ))}
        </div>
      </div>
    );
  }

  const visibleAreas = areaFilter === "todas" ? areas : areas.filter((a) => a.id === areaFilter);
  const filterCursos = (areaId: string) =>
    cursos.filter((c) => c.areaId === areaId && (statusFilter === "todos" || c.status === statusFilter));

  return (
    <div className="stack">
      <Header>
        {areas.length > 0 && (
          <div className="head-actions">
            <button type="button" className="btn btn-ghost" onClick={() => setModal({ kind: "newArea" })}>
              <Icon name="layers" size={18} />
              Nova área
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setModal({ kind: "newCurso", areaId: areaFilter !== "todas" ? areaFilter : areas[0].id })}
            >
              <Icon name="plus" size={18} />
              Novo curso
            </button>
          </div>
        )}
      </Header>

      {areas.length === 0 ? (
        <section className="empty">
          <span className="empty-icon tone-orange">
            <Icon name="layers" size={30} />
          </span>
          <h2>Comece criando uma área</h2>
          <p className="muted">Áreas agrupam seus cursos (ex.: Cloud, Redes). Use uma sugestão ou crie do seu jeito.</p>
          <div className="suggestions">
            {SUGGESTIONS.map((s) => (
              <button
                key={s.nome}
                type="button"
                className={`suggestion tone-${s.cor}`}
                onClick={() => void run(() => cat.createArea(s), `Área “${s.nome}” criada.`)}
                disabled={busy}
              >
                <Icon name="plus" size={16} />
                {s.nome}
              </button>
            ))}
          </div>
          <button type="button" className="btn btn-primary" onClick={() => setModal({ kind: "newArea" })}>
            <Icon name="plus" size={18} />
            Criar área personalizada
          </button>
        </section>
      ) : (
        <>
          <div className="filters">
            <div className="chips" role="group" aria-label="Filtrar por área">
              <button
                type="button"
                className={`chip${areaFilter === "todas" ? " active" : ""}`}
                aria-pressed={areaFilter === "todas"}
                onClick={() => setAreaFilter("todas")}
              >
                Todas as áreas
              </button>
              {areas.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  className={`chip tone-${a.cor}${areaFilter === a.id ? " active" : ""}`}
                  aria-pressed={areaFilter === a.id}
                  onClick={() => setAreaFilter(a.id)}
                >
                  <span className="chip-dot" aria-hidden="true" />
                  {a.nome}
                </button>
              ))}
            </div>

            <div className="segmented" role="group" aria-label="Filtrar por status">
              {(["todos", "em_andamento", "planejado", "pausado", "concluido"] as StatusFilter[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  className={statusFilter === s ? "active" : ""}
                  aria-pressed={statusFilter === s}
                  onClick={() => setStatusFilter(s)}
                >
                  {s === "todos" ? "Todos" : STATUS[s].label}
                  <span className="count">{counts[s]}</span>
                </button>
              ))}
            </div>
          </div>

          {visibleAreas.map((area) => {
            const list = filterCursos(area.id);
            const all = cursos.filter((c) => c.areaId === area.id);
            const avg = all.length ? Math.round(all.reduce((s, c) => s + progress(c).pct, 0) / all.length) : 0;
            const idx = areas.findIndex((a) => a.id === area.id);
            return (
              <section key={area.id} className={`area-section tone-${area.cor}`} aria-label={area.nome}>
                <header className="area-head">
                  <span className="area-badge" aria-hidden="true">
                    {area.nome.charAt(0).toUpperCase()}
                  </span>
                  <div className="area-head-text">
                    <h2>{area.nome}</h2>
                    <p className="muted small">
                      {all.length === 0
                        ? area.descricao || "Nenhum curso ainda"
                        : `${all.length} curso${all.length > 1 ? "s" : ""} · ${avg}% de progresso médio`}
                    </p>
                  </div>
                  <div className="area-actions">
                    <button
                      type="button"
                      className="icon-btn icon-btn-sm"
                      onClick={() => setModal({ kind: "newCurso", areaId: area.id })}
                      aria-label={`Novo curso em ${area.nome}`}
                      title="Novo curso nesta área"
                    >
                      <Icon name="plus" size={16} />
                    </button>
                    <button
                      type="button"
                      className="icon-btn icon-btn-sm"
                      onClick={() => cat.moveArea(area.id, -1).catch((e) => toast.error(friendlyError(e)))}
                      disabled={idx === 0}
                      aria-label={`Mover ${area.nome} para cima`}
                      title="Mover para cima"
                    >
                      <Icon name="chevronUp" size={16} />
                    </button>
                    <button
                      type="button"
                      className="icon-btn icon-btn-sm"
                      onClick={() => cat.moveArea(area.id, 1).catch((e) => toast.error(friendlyError(e)))}
                      disabled={idx === areas.length - 1}
                      aria-label={`Mover ${area.nome} para baixo`}
                      title="Mover para baixo"
                    >
                      <Icon name="chevronDown" size={16} />
                    </button>
                    <button
                      type="button"
                      className="icon-btn icon-btn-sm"
                      onClick={() => setModal({ kind: "editArea", area })}
                      aria-label={`Editar ${area.nome}`}
                      title="Editar área"
                    >
                      <Icon name="edit" size={16} />
                    </button>
                    <button
                      type="button"
                      className="icon-btn icon-btn-sm icon-btn-danger"
                      onClick={() => setDeleting(area)}
                      aria-label={`Apagar ${area.nome}`}
                      title="Apagar área"
                    >
                      <Icon name="trash" size={16} />
                    </button>
                  </div>
                </header>

                {list.length > 0 ? (
                  <div className="course-grid">
                    {list.map((c) => (
                      <CursoCard key={c.id} curso={c} />
                    ))}
                  </div>
                ) : (
                  <div className="area-empty">
                    <span className="muted">
                      {all.length === 0 ? "Nenhum curso nesta área." : "Nenhum curso com este status."}
                    </span>
                    {all.length === 0 && (
                      <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={() => setModal({ kind: "newCurso", areaId: area.id })}
                      >
                        <Icon name="plus" size={16} />
                        Adicionar curso
                      </button>
                    )}
                  </div>
                )}
              </section>
            );
          })}
        </>
      )}

      <Dialog
        open={modal?.kind === "newArea" || modal?.kind === "editArea"}
        title={modal?.kind === "editArea" ? "Editar área" : "Nova área"}
        onClose={() => !busy && setModal(null)}
      >
        {(modal?.kind === "newArea" || modal?.kind === "editArea") && (
          <AreaForm
            key={modal.kind === "editArea" ? modal.area.id : "new"}
            initial={modal.kind === "editArea" ? modal.area : { nome: "", descricao: "", cor: "orange" }}
            busy={busy}
            onCancel={() => setModal(null)}
            onSave={(input) => void saveArea(input)}
          />
        )}
      </Dialog>

      <Dialog open={modal?.kind === "newCurso"} title="Novo curso" onClose={() => !busy && setModal(null)}>
        {modal?.kind === "newCurso" && (
          <CursoForm
            initial={{
              areaId: modal.areaId,
              nome: "",
              plataforma: "",
              url: "",
              status: "planejado",
              prioridade: "media",
              descricao: "",
            }}
            areas={areas}
            withModules
            busy={busy}
            onCancel={() => setModal(null)}
            onSave={(input, titulos) => void saveCurso(input, titulos)}
          />
        )}
      </Dialog>

      <ConfirmDialog
        open={deleting !== null}
        title="Apagar área?"
        message={
          <p>
            A área <strong>{deleting?.nome}</strong> será apagada. Se ela tiver cursos, mova ou apague os cursos antes.
          </p>
        }
        confirmLabel="Apagar área"
        busy={busy}
        onConfirm={() => void confirmDeleteArea()}
        onClose={() => !busy && setDeleting(null)}
      />
    </div>
  );
}

function Header({ children }: { children?: ReactNode }) {
  return (
    <header className="page-head page-head-row">
      <div>
        <p className="eyebrow">Organização</p>
        <h1>Cursos</h1>
        <p className="muted">Seus cursos por área, com progresso e próximo módulo.</p>
      </div>
      {children}
    </header>
  );
}

function CursoCard({ curso }: { curso: Curso }) {
  const p = progress(curso);
  const next = nextModule(curso);
  return (
    <a className="course-card" href={href(`/cursos/${curso.id}`)}>
      <div className="course-card-top">
        <StatusBadge status={curso.status} />
        {curso.plataforma && <span className="muted small ellipsis">{curso.plataforma}</span>}
      </div>
      <h3 className="course-title">{curso.nome}</h3>
      <div className="course-progress">
        <ProgressBar pct={p.pct} tone={curso.status === "concluido" ? "green" : "orange"} label={`Progresso de ${curso.nome}`} />
        <span className="course-pct">{p.pct}%</span>
      </div>
      <p className="course-meta muted small">
        {p.total === 0
          ? "Sem módulos cadastrados"
          : next
            ? `${p.done}/${p.total} módulos · Próximo: ${next.titulo}`
            : `${p.total}/${p.total} módulos concluídos`}
      </p>
    </a>
  );
}
