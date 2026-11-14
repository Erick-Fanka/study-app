// Perfil do usuário: apelido e foto.
// Itens: sk = PERFIL (apelido) e sk = PERFIL#FOTO (foto em data URL, ~10-40 KB).
// A foto fica em item separado para que salvar o apelido não regrave a imagem.
// Uma leitura pelo prefixo "PERFIL" traz os dois.

import type { Store } from "./store";
import { checkText, nowIso } from "./validate";
import { isSafeAvatar } from "./image";

export interface Profile {
  apelido: string;
  foto: string | null;
}

const SK_PERFIL = "PERFIL";
const SK_FOTO = "PERFIL#FOTO";

export function validateApelido(value: string): { value: string; error?: string } {
  return checkText(value, { label: "Apelido", max: 40 });
}

export async function loadProfile(db: Store): Promise<Profile> {
  const items = await db.queryPrefix(SK_PERFIL);
  const perfil = items.find((i) => i.sk === SK_PERFIL);
  const foto = items.find((i) => i.sk === SK_FOTO);
  return {
    apelido: typeof perfil?.apelido === "string" ? perfil.apelido : "",
    // Só usa a foto se for uma imagem em data URL válida.
    foto: isSafeAvatar(foto?.foto) ? (foto!.foto as string) : null,
  };
}

export async function saveApelido(db: Store, apelido: string): Promise<void> {
  // updateItem (e não putItem) para não apagar outros campos que o PERFIL venha a ter.
  await db.updateItem(SK_PERFIL, { tipo: "PERFIL", apelido, atualizadoEm: nowIso() });
}

export async function saveFoto(db: Store, dataUrl: string): Promise<void> {
  if (!isSafeAvatar(dataUrl)) throw new Error("Imagem inválida.");
  await db.putItem({ sk: SK_FOTO, tipo: "PERFIL_FOTO", foto: dataUrl, atualizadoEm: nowIso() });
}

export async function removeFoto(db: Store): Promise<void> {
  await db.deleteItem(SK_FOTO);
}
