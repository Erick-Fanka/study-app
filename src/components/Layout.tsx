import type { ReactNode } from "react";
import { ROUTES, href } from "../router";
import { useTheme, type ThemePref } from "../theme";
import { useProfile } from "../data/ProfileContext";
import { Icon, Logo, type IconName } from "./Icon";
import { Avatar } from "./Avatar";
import { useTimer } from "../data/TimerContext";
import { elapsedMs, fasePomodoro, fmtRelogio } from "../data/cronometro";

const THEME: Record<ThemePref, { label: string; icon: IconName }> = {
  system: { label: "Tema: automático", icon: "monitor" },
  light: { label: "Tema: claro", icon: "sun" },
  dark: { label: "Tema: escuro", icon: "moon" },
};

/** Aviso do cronômetro rodando, visível em qualquer tela. */
function TimerChip({ hidden }: { hidden: boolean }) {
  const { crono, now } = useTimer();
  if (!crono || hidden) return null;
  const rodando = crono.rodandoDesde !== null;
  const fase = crono.modo === "pomodoro" ? fasePomodoro(crono, now) : null;
  const tempo = fase ? fmtRelogio(fase.restanteMs) : fmtRelogio(elapsedMs(crono, now));
  return (
    <a
      className={`timer-chip${rodando ? "" : " paused"}${fase && !fase.foco ? " break" : ""}`}
      href={href("/tempo")}
      title={`${crono.alvo.nome} — abrir cronômetro`}
    >
      <span className="timer-dot" aria-hidden="true" />
      <span className="timer-chip-time">{tempo}</span>
      <span className="timer-chip-label">{fase ? (fase.foco ? "Foco" : "Pausa") : rodando ? crono.alvo.nome : "Pausado"}</span>
    </a>
  );
}

export function Layout({ route, children }: { route: string; children: ReactNode }) {
  const { profile, displayName } = useProfile();
  const [theme, cycleTheme] = useTheme();

  const isActive = (path: string) => (path === "/" ? route === "/" : route.startsWith(path));
  const onProfile = route.startsWith("/perfil");

  return (
    <div className="app">
      <aside className="sidebar">
        <a className="brand" href={href("/")}>
          <Logo size={34} />
          <span className="brand-text">
            <strong>study.app</strong>
            <small>organizador de estudos</small>
          </span>
        </a>

        <nav className="nav" aria-label="Principal">
          {ROUTES.map((r) => (
            <a
              key={r.path}
              href={href(r.path)}
              className={`nav-item accent-${r.accent}${isActive(r.path) ? " active" : ""}`}
              aria-current={isActive(r.path) ? "page" : undefined}
            >
              <Icon name={r.icon} size={20} className="nav-icon" />
              <span className="nav-label">{r.label}</span>
            </a>
          ))}
        </nav>

        <div className="sidebar-footer">
          <a
            className={`user-chip${onProfile ? " active" : ""}`}
            href={href("/perfil")}
            title="Abrir perfil"
            aria-current={onProfile ? "page" : undefined}
          >
            <Avatar name={displayName} foto={profile.foto} size={36} />
            <span className="user-text">
              <strong>{displayName}</strong>
              <small>Perfil</small>
            </span>
          </a>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <a className="brand brand-mobile" href={href("/")}>
            <Logo size={30} />
            <strong>study.app</strong>
          </a>
          <div className="topbar-actions">
            <TimerChip hidden={route === "/tempo"} />
            <button
              type="button"
              className="icon-btn"
              onClick={cycleTheme}
              title={THEME[theme].label}
              aria-label={THEME[theme].label}
            >
              <Icon name={THEME[theme].icon} size={18} />
            </button>
            <a className="topbar-avatar" href={href("/perfil")} aria-label="Abrir perfil" title="Perfil">
              <Avatar name={displayName} foto={profile.foto} size={36} />
            </a>
          </div>
        </header>

        <main className="content">{children}</main>
      </div>
    </div>
  );
}
