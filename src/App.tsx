import { useRoute } from "./router";
import { Layout } from "./components/Layout";
import { HomePage } from "./pages/HomePage";
import { ComingSoon } from "./pages/ComingSoon";
import { CursosPage } from "./pages/CursosPage";
import { ToastProvider } from "./components/Toast";
import { ProfileProvider } from "./data/ProfileContext";
import { PerfilPage } from "./pages/PerfilPage";
import { CursoPage } from "./pages/CursoPage";
import { CatalogProvider } from "./data/CatalogContext";

import { CertsPage } from "./pages/CertsPage";
import { CertPage } from "./pages/CertPage";
import { TempoPage } from "./pages/TempoPage";
import { AgendaPage } from "./pages/AgendaPage";
import { TimerProvider } from "./data/TimerContext";

const CURSO_ROUTE = /^\/cursos\/([0-9a-f-]{36})$/;
const CERT_ROUTE = /^\/certificacoes\/([0-9a-f-]{36})$/;

function renderRoute(route: string) {
  if (route === "/") return <HomePage />;
  if (route === "/cursos") return <CursosPage />;
  const curso = CURSO_ROUTE.exec(route);
  if (curso) return <CursoPage key={curso[1]} id={curso[1]} />;
  if (route === "/certificacoes") return <CertsPage />;
  const cert = CERT_ROUTE.exec(route);
  if (cert) return <CertPage key={cert[1]} id={cert[1]} />;
  if (route === "/tempo") return <TempoPage />;
  if (route === "/agenda") return <AgendaPage />;
  if (route === "/perfil") return <PerfilPage />;
  return <ComingSoon route={route} />;
}

export function App() {
  const route = useRoute();

  return (
    <ToastProvider>
      <ProfileProvider>
        <CatalogProvider>
          <TimerProvider>
            <Layout route={route}>{renderRoute(route)}</Layout>
          </TimerProvider>
        </CatalogProvider>
      </ProfileProvider>
    </ToastProvider>
  );
}
