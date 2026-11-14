import { Icon, Logo } from "./Icon";

export function SetupMessage({ message }: { message: string }) {
  return (
    <main className="center-screen">
      <div className="card narrow setup">
        <Logo size={44} />
        <h1>Não foi possível abrir o app</h1>
        <div className="alert" role="alert">
          <Icon name="alert" size={18} />
          <span>{message}</span>
        </div>
        <p className="muted small">
          Os dados ficam no armazenamento local do navegador. Em janelas anônimas ou com cookies bloqueados ele pode
          não estar disponível.
        </p>
      </div>
    </main>
  );
}
