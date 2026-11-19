import type { AppRow, TableName, Tables } from "./db.types";

export type DbFilter = { column: string; op: "eq" | "in"; value: unknown };
export type DbInput = {
  table: TableName;
  action: "select" | "insert" | "upsert" | "update" | "delete";
  columns?: string;
  values?: Record<string, unknown> | Array<Record<string, unknown>>;
  filters: DbFilter[];
  orderBy?: string;
  ascending?: boolean;
  limit?: number;
  offset?: number;
  search?: { term: string; columns: string[] };
  count?: boolean;
  conflict?: string;
};
export type DbResult<T> = { data: T; error: { message: string } | null; count?: number };
type Executor = (input: DbInput) => Promise<DbResult<unknown>>;

class DbQuery<K extends TableName> implements PromiseLike<DbResult<AppRow<K>[]>> {
  constructor(
    private input: DbInput,
    private executeInput: Executor,
  ) {}
  select(columns = "*") {
    this.input.columns = columns;
    return this;
  }
  insert(values: Partial<Tables[K]> | Array<Partial<Tables[K]>>) {
    this.input.action = "insert";
    this.input.values = values as Record<string, unknown> | Array<Record<string, unknown>>;
    return this;
  }
  upsert(
    values: Partial<Tables[K]> | Array<Partial<Tables[K]>>,
    options?: { onConflict?: string },
  ) {
    this.input.action = "upsert";
    this.input.values = values as Record<string, unknown> | Array<Record<string, unknown>>;
    if (options?.onConflict) this.input.conflict = options.onConflict;
    return this;
  }
  update(values: Partial<Tables[K]>) {
    this.input.action = "update";
    this.input.values = values as Record<string, unknown>;
    return this;
  }
  delete() {
    this.input.action = "delete";
    return this;
  }
  eq(column: keyof Tables[K] & string, value: unknown) {
    this.input.filters.push({ column, op: "eq", value });
    return this;
  }
  in(column: keyof Tables[K] & string, value: unknown[]) {
    this.input.filters.push({ column, op: "in", value });
    return this;
  }
  order(column: keyof Tables[K] & string, options?: { ascending?: boolean }) {
    this.input.orderBy = column;
    this.input.ascending = options?.ascending ?? true;
    return this;
  }
  limit(value: number) {
    this.input.limit = value;
    return this;
  }
  range(from: number, to: number) {
    this.input.offset = from;
    this.input.limit = to - from + 1;
    this.input.count = true;
    return this;
  }
  search(term: string, columns: string[]) {
    this.input.search = { term, columns };
    return this;
  }
  async single(): Promise<DbResult<AppRow<K> | null>> {
    this.input.limit = 1;
    const result = await this.run();
    return {
      data: result.data?.[0] ?? null,
      error: result.error ?? (!result.data?.length ? { message: "No row found" } : null),
    };
  }
  async maybeSingle(): Promise<DbResult<AppRow<K> | null>> {
    this.input.limit = 1;
    const result = await this.run();
    return { data: result.data?.[0] ?? null, error: result.error };
  }
  private async run(): Promise<DbResult<AppRow<K>[]>> {
    return this.executeInput(this.input) as Promise<DbResult<AppRow<K>[]>>;
  }
  then<TResult1 = DbResult<AppRow<K>[]>, TResult2 = never>(
    onfulfilled?: ((value: DbResult<AppRow<K>[]>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return this.run().then(onfulfilled, onrejected);
  }
}

export function createDb(executor: Executor) {
  return {
    from<K extends TableName>(table: K) {
      return new DbQuery<K>({ table, action: "select", filters: [] }, executor);
    },
  };
}
