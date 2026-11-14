// Datas "de calendário" (sem hora) guardadas como "AAAA-MM-DD", no fuso local.

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export function isDate(v: unknown): v is string {
  if (typeof v !== "string" || !DATE.test(v)) return false;
  const [y, m, d] = v.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}

export function todayStr(): string {
  return toDateStr(new Date());
}

export function toDateStr(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function parseDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addYears(s: string, years: number): string {
  const d = parseDate(s);
  d.setFullYear(d.getFullYear() + years);
  return toDateStr(d);
}

/** Dias de hoje até a data (negativo se já passou). */
export function daysUntil(s: string): number {
  const ms = parseDate(s).getTime() - parseDate(todayStr()).getTime();
  return Math.round(ms / 86_400_000);
}

export function fmtDate(s: string, opts: Intl.DateTimeFormatOptions = { day: "2-digit", month: "2-digit", year: "numeric" }): string {
  return isDate(s) ? parseDate(s).toLocaleDateString("pt-BR", opts) : "";
}

export function fmtShort(s: string): string {
  return fmtDate(s, { day: "2-digit", month: "2-digit" });
}

export function relDays(n: number): string {
  if (n === 0) return "hoje";
  if (n === 1) return "amanhã";
  if (n === -1) return "ontem";
  if (n > 0) return `em ${n} dias`;
  return `há ${-n} dias`;
}
