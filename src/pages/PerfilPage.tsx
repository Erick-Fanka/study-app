import { useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { useProfile } from "../data/ProfileContext";
import { validateApelido } from "../data/profile";
import { ImageError, toAvatarDataUrl } from "../data/image";
import { friendlyError } from "../data/store";
import { Avatar } from "../components/Avatar";
import { Icon } from "../components/Icon";
import { ConfirmDialog } from "../components/Dialog";
import { useToast } from "../components/Toast";
import { DadosCard } from "../components/DadosCard";

export function PerfilPage() {
  const { profile, loaded, displayName, defaultName, setApelido, setFoto, clearFoto } = useProfile();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [preview, setPreview] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [savingFoto, setSavingFoto] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);

  const [apelido, setApelidoInput] = useState<string | null>(null);
  const [apelidoError, setApelidoError] = useState<string | undefined>();
  const [savingNome, setSavingNome] = useState(false);

  // Enquanto o perfil carrega, o campo mostra o valor salvo assim que chegar.
  const apelidoValue = apelido ?? profile.apelido;

  const pickFile = () => fileRef.current?.click();

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // permite escolher o mesmo arquivo de novo
    if (!file) return;
    setProcessing(true);
    try {
      setPreview(await toAvatarDataUrl(file));
    } catch (err) {
      toast.error(err instanceof ImageError ? err.message : "Não foi possível usar essa imagem.");
    } finally {
      setProcessing(false);
    }
  };

  const saveFoto = async () => {
    if (!preview) return;
    setSavingFoto(true);
    try {
      await setFoto(preview);
      setPreview(null);
      toast.success("Foto atualizada.");
    } catch (err) {
      toast.error(friendlyError(err));
    } finally {
      setSavingFoto(false);
    }
  };

  const doRemove = async () => {
    setSavingFoto(true);
    try {
      await clearFoto();
      setConfirmRemove(false);
      toast.success("Foto removida.");
    } catch (err) {
      toast.error(friendlyError(err));
    } finally {
      setSavingFoto(false);
    }
  };

  const saveNome = async (e: FormEvent) => {
    e.preventDefault();
    const check = validateApelido(apelidoValue);
    setApelidoError(check.error);
    if (check.error) return;
    setSavingNome(true);
    try {
      await setApelido(check.value);
      setApelidoInput(check.value);
      toast.success(check.value ? "Apelido salvo." : "Apelido removido.");
    } catch (err) {
      toast.error(friendlyError(err));
    } finally {
      setSavingNome(false);
    }
  };

  const shownFoto = preview ?? profile.foto;
  const nomeMudou = apelidoValue.trim() !== profile.apelido;

  return (
    <div className="stack profile-page">
      <header className="page-head">
        <p className="eyebrow">Conta</p>
        <h1>Perfil</h1>
        <p className="muted">Sua foto e o nome que aparece no site.</p>
      </header>

      <section className="card profile-hero">
        <div className="profile-avatar">
          <Avatar name={displayName} foto={shownFoto} size={112} />
          <button
            type="button"
            className="profile-camera"
            onClick={pickFile}
            disabled={processing || savingFoto}
            aria-label="Escolher foto"
            title="Escolher foto"
          >
            <Icon name="camera" size={18} />
          </button>
        </div>

        <div className="profile-id">
          <h2>{displayName}</h2>

          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            tabIndex={-1}
            onChange={(e) => void onFile(e)}
          />

          {preview ? (
            <div className="profile-buttons">
              <span className="pill">Pré-visualização</span>
              <button type="button" className="btn btn-primary" onClick={() => void saveFoto()} disabled={savingFoto}>
                <Icon name="check" size={18} />
                {savingFoto ? "Salvando…" : "Salvar foto"}
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => setPreview(null)} disabled={savingFoto}>
                Cancelar
              </button>
            </div>
          ) : (
            <div className="profile-buttons">
              <button type="button" className="btn btn-ghost" onClick={pickFile} disabled={processing || !loaded}>
                <Icon name="camera" size={18} />
                {processing ? "Preparando…" : profile.foto ? "Trocar foto" : "Adicionar foto"}
              </button>
              {profile.foto && (
                <button
                  type="button"
                  className="btn btn-quiet"
                  onClick={() => setConfirmRemove(true)}
                  disabled={savingFoto}
                >
                  <Icon name="trash" size={18} />
                  Remover
                </button>
              )}
            </div>
          )}
          <p className="muted small">JPG, PNG ou WebP. A foto é recortada em quadrado e reduzida antes de salvar.</p>
        </div>
      </section>

      <section className="card">
        <h2>Como quer ser chamado?</h2>
        <form className="form" onSubmit={(e) => void saveNome(e)} noValidate>
          <div className="field">
            <label htmlFor="perfil-apelido">Apelido</label>
            <input
              id="perfil-apelido"
              className="input"
              value={apelidoValue}
              onChange={(e) => setApelidoInput(e.target.value)}
              maxLength={40}
              placeholder={defaultName}
              disabled={!loaded}
              aria-invalid={apelidoError ? true : undefined}
            />
            {apelidoError ? (
              <p className="field-error">{apelidoError}</p>
            ) : (
              <p className="muted small">Deixe em branco para aparecer como "{defaultName}".</p>
            )}
          </div>

          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={savingNome || !loaded || !nomeMudou}>
              {savingNome ? "Salvando…" : "Salvar apelido"}
            </button>
          </div>
        </form>
      </section>

      <DadosCard />

      <ConfirmDialog
        open={confirmRemove}
        title="Remover foto?"
        message={<p>Sua foto de perfil será apagada e as iniciais voltam a aparecer.</p>}
        confirmLabel="Remover foto"
        busy={savingFoto}
        onConfirm={() => void doRemove()}
        onClose={() => !savingFoto && setConfirmRemove(false)}
      />
    </div>
  );
}
