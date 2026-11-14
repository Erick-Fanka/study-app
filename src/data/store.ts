// Armazenamento local no navegador (IndexedDB). Cada item tem uma chave `sk`
// textual (ex.: "CURSO#<id>"); as listagens usam prefixo ou intervalo de chaves,
// sempre em ordem crescente de `sk`.

export type Item = Record<string, unknown>;

export type StoreErrorCode = "exists" | "missing" | "unavailable";

export class StoreError extends Error {
  constructor(
    readonly code: StoreErrorCode,
    message: string,
  ) {
    super(message);
  }
}

export interface WriteOptions {
  /** Só grava se o item já existir. */
  mustExist?: boolean;
  /** Só grava se o item ainda não existir. */
  mustNotExist?: boolean;
}

const DB_NAME = "study-app";
const DB_VERSION = 1;
const STORE = "itens";

function promisify<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function done(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new StoreError("unavailable", "Transação cancelada."));
  });
}

/** Cópia profunda que descarta campos `undefined` (como o JSON faria). */
function clean(item: Item): Item {
  return JSON.parse(JSON.stringify(item)) as Item;
}

function checkWrite(existing: unknown, sk: string, opts: WriteOptions): void {
  if (opts.mustExist && existing === undefined) {
    throw new StoreError("missing", `Item não encontrado: ${sk}`);
  }
  if (opts.mustNotExist && existing !== undefined) {
    throw new StoreError("exists", `Item já existe: ${sk}`);
  }
}

export class Store {
  private constructor(private readonly db: IDBDatabase) {}

  static async open(): Promise<Store> {
    if (typeof indexedDB === "undefined") {
      throw new StoreError("unavailable", "Este navegador não oferece armazenamento local (IndexedDB).");
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE, { keyPath: "sk" });
      }
    };
    try {
      return new Store(await promisify(req));
    } catch {
      throw new StoreError("unavailable", "Não foi possível abrir o armazenamento local do navegador.");
    }
  }

  private tx(mode: IDBTransactionMode): { tx: IDBTransaction; os: IDBObjectStore } {
    const tx = this.db.transaction(STORE, mode);
    return { tx, os: tx.objectStore(STORE) };
  }

  async getItem(sk: string): Promise<Item | null> {
    const { os } = this.tx("readonly");
    const item = (await promisify(os.get(sk))) as Item | undefined;
    return item ?? null;
  }

  async putItem(item: Item, opts: WriteOptions = {}): Promise<void> {
    const sk = item.sk;
    if (typeof sk !== "string" || !sk) throw new StoreError("missing", "Item sem chave.");
    const { tx, os } = this.tx("readwrite");
    const finished = done(tx);
    if (opts.mustExist || opts.mustNotExist) {
      checkWrite(await promisify(os.getKey(sk)), sk, opts);
    }
    os.put(clean(item));
    await finished;
  }

  /** Grava só os campos informados, mantendo os demais. Retorna o item completo. */
  async updateItem(sk: string, fields: Item, opts: Pick<WriteOptions, "mustExist"> = {}): Promise<Item> {
    const { tx, os } = this.tx("readwrite");
    const finished = done(tx);
    const existing = (await promisify(os.get(sk))) as Item | undefined;
    checkWrite(existing, sk, opts);
    const next = clean({ ...(existing ?? {}), ...fields, sk });
    os.put(next);
    await finished;
    return next;
  }

  async deleteItem(sk: string): Promise<void> {
    const { tx, os } = this.tx("readwrite");
    const finished = done(tx);
    os.delete(sk);
    await finished;
  }

  /** Itens cuja chave começa com `prefix`. */
  queryPrefix(prefix: string, limit?: number): Promise<Item[]> {
    return this.queryRange(prefix, prefix + "￿", limit);
  }

  /** Itens com `from <= sk <= to`. */
  async queryRange(from: string, to: string, limit?: number): Promise<Item[]> {
    const { os } = this.tx("readonly");
    return (await promisify(os.getAll(IDBKeyRange.bound(from, to), limit))) as Item[];
  }

  /** Todos os itens (backup). */
  async all(): Promise<Item[]> {
    const { os } = this.tx("readonly");
    return (await promisify(os.getAll())) as Item[];
  }
}

/** Mensagem amigável para mostrar na tela. */
export function friendlyError(e: unknown): string {
  if (e instanceof StoreError) {
    switch (e.code) {
      case "missing":
      case "exists":
        return "O item foi alterado ou removido em outra aba. Recarregue a página.";
      case "unavailable":
        return e.message;
    }
  }
  if (e instanceof DOMException && e.name === "QuotaExceededError") {
    return "O armazenamento do navegador está cheio. Exporte um backup e libere espaço.";
  }
  return "Algo deu errado ao salvar ou carregar os dados.";
}
