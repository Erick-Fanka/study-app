import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { Icon } from "./Icon";

type Kind = "success" | "error";
interface ToastItem {
  id: number;
  kind: Kind;
  text: string;
}

interface ToastApi {
  success: (text: string) => void;
  error: (text: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const next = useRef(1);

  const push = useCallback((kind: Kind, text: string) => {
    const id = next.current++;
    setItems((list) => [...list.slice(-2), { id, kind, text }]);
    setTimeout(() => setItems((list) => list.filter((t) => t.id !== id)), kind === "error" ? 6000 : 3000);
  }, []);

  const api = useRef<ToastApi>({
    success: (t) => push("success", t),
    error: (t) => push("error", t),
  }).current;

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={`toast toast-${t.kind}`}>
            <Icon name={t.kind === "success" ? "check" : "alert"} size={18} />
            <span>{t.text}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const t = useContext(ToastContext);
  if (!t) throw new Error("ToastProvider ausente");
  return t;
}
