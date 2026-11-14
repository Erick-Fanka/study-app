// Seus dados: backup (exportar/importar JSON) e dados de exemplo.

import { useRef, useState, type ChangeEvent } from "react";
import { useServices } from "../services";
import { friendlyError, type Item } from "../data/store";
import { useCatalog } from "../data/CatalogContext";
import { useTimer } from "../data/TimerContext";
import { TIPOS_LABEL, baixarJson, contar, exportar, importar, validarBackup } from "../data/backup";
import { apagarExemplos, criarExemplos } from "../data/exemplos";
import { todayStr } from "../data/dates";
import { Icon } from "./Icon";
import { ConfirmDialog } from "./Dialog";
import { useToast } from "./Toast";

export function DadosCard() {
  const { db } = useServices();
  const cat = useCatalog();
  const timer = useTimer();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<null | "exportar" | "importar" | "exemplos" | "apagar">(null);
  const [pendente, setPendente] = useState<{ itens: Item[]; ignorados: number; nome: string } | null>(null);
  const [progresso, setProgresso] = useState(0);
  const [confirmApagar, setConfirmApagar] = useState(false);

  const recarregar = async () => {
    await cat.reload();
    timer.bumpSessions();
  };

  const doExport = async () => {
    setBusy("exportar");
    try {
      const b = await exportar(db);
      baixarJson(`study-app-backup-${todayStr()}.json`, b);
      toast.success(`Backup com ${b.total} itens baixado.`);
    } catch (e) {
      toast.error(friendlyError(e));
    } finally {
      setBusy(null);
    }
  };

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 30 * 1024 * 1024) return toast.error("Arquivo grande demais (máximo 30 MB).");
    const r = validarBackup(await file.text());
    if (r.erro || !r.itens) return toast.error(r.erro ?? "Backup inválido.");
    setPendente({ itens: r.itens, ignorados: r.ignorados ?? 0, nome: file.name });
  };

  const doImport = async () => {
    if (!pendente) return;
    setBusy("importar");
    setProgresso(0);
    try {
      await importar(db, pendente.itens, setProgresso);
      toast.success(`${pendente.itens.length} itens restaurados.`);
      setPendente(null);
      await recarregar();
    } catch (e) {
      toast.error(`Importação interrompida: ${friendlyError(e)}`);
    } finally {
      setBusy(null);
    }
  };

  const doExemplos = async () => {
    setBusy("exemplos");
    try {
      await criarExemplos(db);
      await recarregar();
      toast.success("Exemplos adicionados: veja Cursos, Agenda e Início.");
    } catch (e) {
      toast.error(friendlyError(e));
    } finally {
      setBusy(null);
    }
  };

  const doApagar = async () => {
    setBusy("apagar");
    try {
      const n = await apagarExemplos(db);
      await recarregar();
      toast.success(n ? `${n} itens de exemplo apagados.` : "Não havia exemplos para apagar.");
      setConfirmApagar(false);
    } catch (e) {
      toast.error(friendlyError(e));
    } finally {
      setBusy(null);
    }
  };

  const contagem = pendente ? contar(pendente.itens) : {};

  return (
    <section className="card">
      <h2>Seus dados</h2>

      <div className="dados-row">
        <span className="material-icon tone-blue">
          <Icon name="file" size={18} />
        </span>
        <div className="dados-text">
          <strong>Backup</strong>
          <p className="muted small">
            Baixe uma cópia de tudo (cursos, certificações, simulados, agenda, sessões e perfil) em JSON. Os dados ficam só
            neste navegador: limpar os dados do site apaga tudo, então guarde o backup em lugar seguro.
          </p>
          <div className="dados-actions">
            <button type="button" className="btn btn-primary btn-sm" onClick={() => void doExport()} disabled={busy !== null}>
              {busy === "exportar" ? "Gerando…" : "Exportar backup"}
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => fileRef.current?.click()} disabled={busy !== null}>
              Importar backup
            </button>
            <input ref={fileRef} type="file" accept="application/json,.json" className="sr-only" tabIndex={-1} onChange={(e) => void onFile(e)} />
          </div>
        </div>
      </div>

      <div className="dados-row">
        <span className="material-icon tone-orange">
          <Icon name="layers" size={18} />
        </span>
        <div className="dados-text">
          <strong>Dados de exemplo</strong>
          <p className="muted small">
            Uma área, um curso com módulos, um lab, um bloco semanal e um prazo, todos marcados como “Exemplo”. Apagar
            exemplos não mexe nos seus dados reais.
          </p>
          <div className="dados-actions">
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => void doExemplos()} disabled={busy !== null}>
              {busy === "exemplos" ? "Adicionando…" : "Adicionar exemplos"}
            </button>
            <button type="button" className="btn btn-quiet btn-sm" onClick={() => setConfirmApagar(true)} disabled={busy !== null}>
              <Icon name="trash" size={16} />
              Apagar exemplos
            </button>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={pendente !== null}
        title="Restaurar backup?"
        message={
          <div className="stack-sm">
            <p>
              Arquivo <strong>{pendente?.nome}</strong> com {pendente?.itens.length} itens:
            </p>
            <ul className="backup-list">
              {Object.entries(contagem).map(([t, n]) => (
                <li key={t}>
                  {TIPOS_LABEL[t] ?? t}: <strong>{n}</strong>
                </li>
              ))}
            </ul>
            {pendente && pendente.ignorados > 0 && (
              <p className="muted small">{pendente.ignorados} item(ns) desconhecido(s) serão ignorados.</p>
            )}
            <p className="muted small">
              Itens com o mesmo identificador serão substituídos pela versão do backup. Nada é apagado.
            </p>
            {busy === "importar" && pendente && (
              <p>
                Gravando {progresso} de {pendente.itens.length}…
              </p>
            )}
          </div>
        }
        confirmLabel="Restaurar"
        busyLabel="Restaurando…"
        danger={false}
        busy={busy === "importar"}
        onConfirm={() => void doImport()}
        onClose={() => busy !== "importar" && setPendente(null)}
      />

      <ConfirmDialog
        open={confirmApagar}
        title="Apagar exemplos?"
        message={<p>Serão apagados só os itens marcados como exemplo. Seus dados reais continuam como estão.</p>}
        confirmLabel="Apagar exemplos"
        busy={busy === "apagar"}
        onConfirm={() => void doApagar()}
        onClose={() => busy !== "apagar" && setConfirmApagar(false)}
      />
    </section>
  );
}
