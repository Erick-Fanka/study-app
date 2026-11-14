// Tema: segue o sistema por padrão; o botão alterna sistema → claro → escuro.
// A escolha fica só neste navegador (preferência local).

import { useEffect, useState } from "react";

export type ThemePref = "system" | "light" | "dark";

const KEY = "estudos.tema";

function read(): ThemePref {
  try {
    const v = localStorage.getItem(KEY);
    return v === "light" || v === "dark" ? v : "system";
  } catch {
    return "system";
  }
}

export function applyTheme(pref: ThemePref): void {
  const root = document.documentElement;
  if (pref === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", pref);
}

export function initTheme(): void {
  applyTheme(read());
}

export function useTheme(): [ThemePref, () => void] {
  const [pref, setPref] = useState<ThemePref>(read);

  useEffect(() => {
    applyTheme(pref);
    try {
      if (pref === "system") localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, pref);
    } catch {
      /* armazenamento indisponível */
    }
  }, [pref]);

  const cycle = () =>
    setPref((p) => (p === "system" ? "light" : p === "light" ? "dark" : "system"));

  return [pref, cycle];
}
