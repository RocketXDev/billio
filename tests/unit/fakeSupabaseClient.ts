// Stand-in for src/lib/supabaseClient in unit tests: a query builder over an
// in-memory table that enforces a configurable "Max rows" cap like PostgREST.
type Row = Record<string, any>;

export const fakeDb: { rows: Row[]; cap: number; calls: any[]; failOnCall: number | null } = {
  rows: [], cap: 1000, calls: [], failOnCall: null,
};

function builder(table: string) {
  const q: any = { table, filters: [] as any[], orders: [] as any[], range: null, select: null };
  const api: any = {
    select(cols: string) { q.select = cols; return api; },
    eq(col: string, v: any) { q.filters.push(["eq", col, v]); return api; },
    gte(col: string, v: any) { q.filters.push(["gte", col, v]); return api; },
    lte(col: string, v: any) { q.filters.push(["lte", col, v]); return api; },
    order(col: string, opts: any) { q.orders.push([col, opts?.ascending !== false]); return api; },
    range(a: number, b: number) { q.range = [a, b]; return api; },
    then(resolve: any, reject: any) {
      fakeDb.calls.push(structuredClone(q));
      if (fakeDb.failOnCall === fakeDb.calls.length) {
        return Promise.resolve({ data: null, error: { message: "boom" } }).then(resolve, reject);
      }
      let rows = fakeDb.rows.filter((r) => q.filters.every(([op, col, v]: any) =>
        op === "eq" ? r[col] === v : op === "gte" ? r[col] >= v : r[col] <= v));
      rows = [...rows].sort((x, y) => {
        for (const [col, asc] of q.orders) {
          if (x[col] < y[col]) return asc ? -1 : 1;
          if (x[col] > y[col]) return asc ? 1 : -1;
        }
        return 0;
      });
      const [a, b] = q.range ?? [0, rows.length - 1];
      return Promise.resolve({ data: rows.slice(a, b + 1).slice(0, fakeDb.cap), error: null }).then(resolve, reject);
    },
  };
  return api;
}

export const supabase = { from: builder };
