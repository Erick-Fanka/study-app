import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useServices } from "../services";
import { loadProfile, removeFoto, saveApelido, saveFoto, type Profile } from "./profile";

/** Nome mostrado enquanto não houver apelido salvo. */
const DEFAULT_NAME = "Estudante";

interface ProfileApi {
  profile: Profile;
  loaded: boolean;
  /** Apelido, se houver; senão o nome padrão. */
  displayName: string;
  defaultName: string;
  setApelido: (apelido: string) => Promise<void>;
  setFoto: (dataUrl: string) => Promise<void>;
  clearFoto: () => Promise<void>;
}

const ProfileContext = createContext<ProfileApi | null>(null);

export function ProfileProvider({ children }: { children: ReactNode }) {
  const { db } = useServices();
  const [profile, setProfile] = useState<Profile>({ apelido: "", foto: null });
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    loadProfile(db)
      .then((p) => active && setProfile(p))
      .catch(() => undefined) // sem perfil salvo: usa o nome padrão
      .finally(() => active && setLoaded(true));
    return () => {
      active = false;
    };
  }, [db]);

  const setApelido = useCallback(
    async (apelido: string) => {
      await saveApelido(db, apelido);
      setProfile((p) => ({ ...p, apelido }));
    },
    [db],
  );

  const setFoto = useCallback(
    async (dataUrl: string) => {
      await saveFoto(db, dataUrl);
      setProfile((p) => ({ ...p, foto: dataUrl }));
    },
    [db],
  );

  const clearFoto = useCallback(async () => {
    await removeFoto(db);
    setProfile((p) => ({ ...p, foto: null }));
  }, [db]);

  const value = useMemo<ProfileApi>(
    () => ({
      profile,
      loaded,
      displayName: profile.apelido || DEFAULT_NAME,
      defaultName: DEFAULT_NAME,
      setApelido,
      setFoto,
      clearFoto,
    }),
    [profile, loaded, setApelido, setFoto, clearFoto],
  );

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

export function useProfile(): ProfileApi {
  const p = useContext(ProfileContext);
  if (!p) throw new Error("ProfileProvider ausente");
  return p;
}
