// Validação e limpeza de texto digitado pelo usuário antes de gravar.

// Remove caracteres de controle (exceto quebra de linha e tab) e espaços nas pontas.
export function cleanText(value: string, opts: { multiline?: boolean } = {}): string {
  const noControl = value.replace(opts.multiline ? /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g : /[\u0000-\u001F\u007F]/g, "");
  return noControl.trim();
}

export interface FieldRule {
  label: string;
  required?: boolean;
  max: number;
  multiline?: boolean;
}

/** Retorna o texto limpo ou uma mensagem de erro. */
export function checkText(value: string, rule: FieldRule): { value: string; error?: string } {
  const v = cleanText(value, { multiline: rule.multiline });
  if (rule.required && v.length === 0) return { value: v, error: `${rule.label} é obrigatório.` };
  if (v.length > rule.max) return { value: v, error: `${rule.label}: no máximo ${rule.max} caracteres.` };
  return { value: v };
}

/** Aceita só links http(s). Bloqueia javascript:, data: e afins. */
export function checkUrl(value: string, opts: { label?: string; required?: boolean } = {}): { value: string; error?: string } {
  const label = opts.label ?? "Link";
  const v = cleanText(value);
  if (!v) return opts.required ? { value: "", error: `${label} é obrigatório.` } : { value: "" };
  if (v.length > 2000) return { value: v, error: `${label}: muito longo.` };
  let url: URL;
  try {
    url = new URL(/^[a-z][a-z0-9+.-]*:/i.test(v) ? v : `https://${v}`);
  } catch {
    return { value: v, error: `${label} inválido.` };
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return { value: v, error: `${label}: use um endereço começando com https://` };
  }
  if (!url.hostname.includes(".")) return { value: v, error: `${label} inválido.` };
  return { value: url.href };
}

/** Para exibir: só devolve o link se ainda for http(s). */
export function safeHref(value: string): string | undefined {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : undefined;
  } catch {
    return undefined;
  }
}

export function newId(): string {
  return crypto.randomUUID();
}

export function nowIso(): string {
  return new Date().toISOString();
}
