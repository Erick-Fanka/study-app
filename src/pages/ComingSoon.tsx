import { ROUTES, href } from "../router";
import { Icon } from "../components/Icon";

export function ComingSoon({ route }: { route: string }) {
  const def = ROUTES.find((r) => r.path !== "/" && route.startsWith(r.path));

  if (!def) {
    return (
      <section className="empty">
        <span className="empty-icon tone-ink">
          <Icon name="alert" size={30} />
        </span>
        <h1>Página não encontrada</h1>
        <p className="muted">O endereço não existe neste site.</p>
        <a className="btn btn-primary" href={href("/")}>
          <Icon name="arrowLeft" size={18} />
          Voltar para o início
        </a>
      </section>
    );
  }

  return (
    <section className="empty">
      <span className={`empty-icon tone-${def.accent}`}>
        <Icon name={def.icon} size={30} />
      </span>
      <span className="pill">{def.step}</span>
      <h1>{def.label}</h1>
      <p className="muted">{def.description}</p>
      <p className="muted small">Esta área está em construção.</p>
      <a className="btn btn-ghost" href={href("/")}>
        <Icon name="arrowLeft" size={18} />
        Voltar para o início
      </a>
    </section>
  );
}
