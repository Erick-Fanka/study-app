import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Store, StoreError } from "./data/store";
import { ServicesProvider } from "./services";
import { initTheme } from "./theme";
import { App } from "./App";
import { SetupMessage } from "./components/SetupMessage";
import "./styles.css";

initTheme();

const root = createRoot(document.getElementById("root")!);

async function start() {
  try {
    const db = await Store.open();
    root.render(
      <StrictMode>
        <ServicesProvider value={{ db }}>
          <App />
        </ServicesProvider>
      </StrictMode>,
    );
  } catch (e) {
    const message = e instanceof StoreError ? e.message : "Erro inesperado ao iniciar o site.";
    root.render(<SetupMessage message={message} />);
  }
}

void start();

// PWA: só em produção (no localhost o Vite já recarrega sozinho).
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  });
}
