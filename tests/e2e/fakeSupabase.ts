// In-memory stand-in for the Supabase project, served to the real app through
// Playwright request interception. Implements the slice of PostgREST + Auth
// that Billio uses: eq/neq/gte/lte/gt/lt/in/is/not filters, order, offset/
// limit (with the 1,000-row "Max rows" cap), embedded selects (incl. !inner),
// single()/maybeSingle(), insert/upsert/update/delete with return=representation.
//
// Every request is logged so tests can assert on what the app sent, and
// failRules let a test make a specific call fail to exercise error paths.

import type { Route } from "playwright";

export type Row = Record<string, any>;
export type RequestLog = { method: string; table: string; params: URLSearchParams; body: any };
export type FailRule = { method: string; table: string; times?: number; message?: string };

const MAX_ROWS = 1000;

const SINGULAR: Record<string, string> = {
  coaches: "coach",
  students: "student",
  lessons: "lesson",
  invoices: "invoice",
  profiles: "profile",
};
const singular = (table: string) => SINGULAR[table] ?? table.replace(/s$/, "");

let idCounter = 0;
export const newId = (prefix = "row") => `${prefix}-${String(++idCounter).padStart(6, "0")}`;

type SelectNode =
  | { kind: "star" }
  | { kind: "col"; name: string; alias: string }
  | { kind: "embed"; table: string; alias: string; inner: boolean; children: SelectNode[] };

function splitTopLevel(input: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  for (const ch of input) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && depth === 0) {
      parts.push(current);
      current = "";
    } else current += ch;
  }
  if (current) parts.push(current);
  return parts;
}

export function parseSelect(select: string | null): SelectNode[] {
  if (!select) return [{ kind: "star" }];
  return splitTopLevel(select.replace(/\s+/g, "")).map((part): SelectNode => {
    if (part === "*") return { kind: "star" };
    const open = part.indexOf("(");
    const [aliasPart, rest] = part.includes(":") && (open === -1 || part.indexOf(":") < open)
      ? [part.slice(0, part.indexOf(":")), part.slice(part.indexOf(":") + 1)]
      : [null, part];
    if (open === -1) {
      const name = rest.split("::")[0];
      return { kind: "col", name, alias: aliasPart ?? name };
    }
    const head = rest.slice(0, rest.indexOf("("));
    const inner = rest.slice(rest.indexOf("(") + 1, rest.lastIndexOf(")"));
    const [table, hint] = head.split("!");
    return { kind: "embed", table, alias: aliasPart ?? table, inner: hint === "inner", children: parseSelect(inner) };
  });
}

function parseValue(raw: string): any {
  if (raw === "null") return null;
  if (raw === "true") return true;
  if (raw === "false") return false;
  return raw.replace(/^"(.*)"$/, "$1");
}

function compare(a: any, b: any): number {
  if (typeof a === "number" || typeof b === "number") return Number(a) - Number(b);
  return String(a).localeCompare(String(b));
}

function matches(value: any, op: string, raw: string): boolean {
  if (op.startsWith("not.")) {
    const [innerOp, ...rest] = op.slice(4).split(".");
    return !matches(value, innerOp, rest.length ? `${rest.join(".")}.${raw}` : raw);
  }
  switch (op) {
    case "eq": {
      const v = parseValue(raw);
      if (typeof value === "boolean" || typeof v === "boolean") return value === v;
      return value != null && compare(value, v) === 0;
    }
    case "neq":
      return value == null || compare(value, parseValue(raw)) !== 0;
    case "gt": return value != null && compare(value, parseValue(raw)) > 0;
    case "gte": return value != null && compare(value, parseValue(raw)) >= 0;
    case "lt": return value != null && compare(value, parseValue(raw)) < 0;
    case "lte": return value != null && compare(value, parseValue(raw)) <= 0;
    case "is":
      return raw === "null" ? value == null : value === parseValue(raw);
    case "in": {
      const list = splitTopLevel(raw.replace(/^\(/, "").replace(/\)$/, "")).map(parseValue);
      return list.some((v) => value != null && compare(value, v) === 0);
    }
    default:
      throw new Error(`fake PostgREST: unsupported operator "${op}"`);
  }
}

const RESERVED = new Set(["select", "order", "offset", "limit", "on_conflict", "columns"]);

export class FakeSupabase {
  db: Record<string, Row[]> = {};
  log: RequestLog[] = [];
  failRules: FailRule[] = [];
  // "DELETE notifications" etc.: succeed but change nothing, like RLS with no policy for that command.
  silentlyBlocked = new Set<string>();
  internalErrors: string[] = [];

  user: Row;

  constructor(user: Row, seed: Record<string, Row[]> = {}) {
    this.user = user;
    for (const [table, rows] of Object.entries(seed)) this.db[table] = rows.map((r) => ({ ...r }));
  }

  rows(table: string) {
    return (this.db[table] ??= []);
  }

  requests(method: string, table: string) {
    return this.log.filter((r) => r.method === method && r.table === table);
  }

  failNext(method: string, table: string, message = "E2E simulated failure") {
    this.failRules.push({ method, table, times: 1, message });
  }

  async handle(route: Route) {
    const request = route.request();
    const url = new URL(request.url());
    const cors = {
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "*",
      "access-control-allow-methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS",
      "access-control-expose-headers": "content-range, x-total-count",
    };
    const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
      route.fulfill({
        status,
        headers: { ...cors, "content-type": "application/json", ...headers },
        body: body === undefined ? "" : JSON.stringify(body),
      });

    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });

    try {
      const path = url.pathname;
      if (path.startsWith("/auth/v1/")) return this.auth(path, request.method(), json);
      if (path.startsWith("/functions/v1/")) {
        this.log.push({ method: request.method(), table: `fn:${path.slice(14)}`, params: url.searchParams, body: safeJson(request.postData()) });
        return json(200, {});
      }
      if (path.startsWith("/rest/v1/rpc/")) {
        this.log.push({ method: "RPC", table: path.slice(13), params: url.searchParams, body: safeJson(request.postData()) });
        return json(200, null);
      }
      if (path.startsWith("/storage/v1/")) return json(200, {});
      if (path.startsWith("/rest/v1/")) return this.rest(path.slice(9), request, url, json);
      return json(404, { message: "not found" });
    } catch (e: any) {
      this.internalErrors.push(`${request.method()} ${url.pathname}${url.search}: ${e?.message || e}`);
      return json(500, { message: `fake backend error: ${e?.message || e}` });
    }
  }

  private auth(path: string, method: string, json: (s: number, b: unknown) => Promise<void>) {
    if (path === "/auth/v1/user" && method === "GET") return json(200, this.user);
    if (path === "/auth/v1/logout") return json(204, undefined);
    if (path === "/auth/v1/token") return json(200, sessionFor(this.user));
    return json(200, {});
  }

  private async rest(table: string, request: any, url: URL, json: (s: number, b: unknown, h?: Record<string, string>) => Promise<void>) {
    const method = request.method();
    const params = url.searchParams;
    const body = safeJson(request.postData());
    this.log.push({ method, table, params, body });

    const rule = this.failRules.find((r) => r.method === method && r.table === table && (r.times ?? 1) > 0);
    if (rule) {
      rule.times = (rule.times ?? 1) - 1;
      return json(400, { message: rule.message, code: "E2E01", details: null, hint: null });
    }

    const headers = request.headers();
    const prefer = headers["prefer"] || "";
    const wantsObject = (headers["accept"] || "").includes("vnd.pgrst.object+json");
    const nodes = parseSelect(params.get("select"));
    const respond = (rows: Row[], status: number) => {
      const projected = rows.map((r) => this.project(table, r, nodes));
      if (wantsObject) {
        if (projected.length !== 1) {
          return json(406, {
            code: "PGRST116",
            message: "JSON object requested, multiple (or no) rows returned",
            details: `The result contains ${projected.length} rows`,
            hint: null,
          });
        }
        return json(status, projected[0]);
      }
      return json(status, projected);
    };

    const filtered = () => this.filter(table, params, nodes);

    if (method === "GET" || method === "HEAD") {
      let rows = this.order(filtered(), params.get("order"));
      const offset = Number(params.get("offset") || 0);
      const limit = params.has("limit") ? Number(params.get("limit")) : Infinity;
      rows = rows.slice(offset, offset + Math.min(limit, MAX_ROWS));
      return respond(rows, 200);
    }

    const representation = prefer.includes("return=representation");

    if (method === "POST") {
      const incoming: Row[] = Array.isArray(body) ? body : [body];
      const conflictCols = params.get("on_conflict")?.split(",");
      const ignoreDuplicates = prefer.includes("resolution=ignore-duplicates");
      const mergeDuplicates = prefer.includes("resolution=merge-duplicates");
      const written: Row[] = [];
      for (const raw of incoming) {
        const existing = conflictCols
          ? this.rows(table).find((r) => conflictCols.every((c) => r[c] === raw[c]))
          : undefined;
        if (existing) {
          if (ignoreDuplicates) continue;
          if (mergeDuplicates) {
            Object.assign(existing, raw);
            written.push(existing);
            continue;
          }
          return json(409, { code: "23505", message: `duplicate key value violates unique constraint on ${table}` });
        }
        const row = { id: newId(singular(table)), created_at: new Date().toISOString(), ...raw };
        this.rows(table).push(row);
        written.push(row);
      }
      return representation ? respond(written, 201) : json(201, undefined);
    }

    if (this.silentlyBlocked.has(`${method} ${table}`)) {
      return representation ? respond([], 200) : json(204, undefined);
    }

    if (method === "PATCH") {
      const rows = filtered();
      for (const r of rows) Object.assign(r, body);
      return representation ? respond(rows, 200) : json(204, undefined);
    }

    if (method === "DELETE") {
      const rows = filtered();
      this.db[table] = this.rows(table).filter((r) => !rows.includes(r));
      return representation ? respond(rows, 200) : json(204, undefined);
    }

    return json(405, { message: `method ${method} not supported by fake` });
  }

  private filter(table: string, params: URLSearchParams, nodes: SelectNode[]) {
    const filters = [...params.entries()].filter(([key]) => !RESERVED.has(key));
    return this.rows(table).filter((row) => {
      for (const [col, expr] of filters) {
        // "not.is.null" -> op "not.is", value "null"
        const dot = expr.startsWith("not.") ? expr.indexOf(".", 4) : expr.indexOf(".");
        const op = expr.slice(0, dot);
        const raw = expr.slice(dot + 1);
        if (col.includes(".")) throw new Error(`filters on embedded columns not supported: ${col}`);
        if (!matches(row[col], op, raw)) return false;
      }
      // !inner embeds drop rows whose embed resolves to nothing.
      for (const node of nodes) {
        if (node.kind === "embed" && node.inner) {
          const related = this.related(table, row, node.table);
          if (related == null || (Array.isArray(related) && related.length === 0)) return false;
        }
      }
      return true;
    });
  }

  private order(rows: Row[], order: string | null) {
    if (!order) return rows;
    const keys = order.split(",").map((part) => {
      const [col, dir = "asc", nulls] = part.split(".");
      return { col, desc: dir === "desc", nullsFirst: nulls ? nulls === "nullsfirst" : dir === "desc" };
    });
    return [...rows].sort((a, b) => {
      for (const { col, desc, nullsFirst } of keys) {
        const av = a[col], bv = b[col];
        if (av == null && bv == null) continue;
        if (av == null) return nullsFirst ? -1 : 1;
        if (bv == null) return nullsFirst ? 1 : -1;
        const c = compare(av, bv);
        if (c !== 0) return desc ? -c : c;
      }
      return 0;
    });
  }

  // Many-to-one when the row carries `<embed>_id`, otherwise one-to-many via
  // the child's `<table>_id` — the FK naming Billio's schema follows.
  private related(table: string, row: Row, embedTable: string) {
    const fk = `${singular(embedTable)}_id`;
    if (fk in row) {
      return row[fk] == null ? null : this.rows(embedTable).find((r) => r.id === row[fk]) ?? null;
    }
    const backFk = `${singular(table)}_id`;
    return this.rows(embedTable).filter((r) => r[backFk] === row.id);
  }

  private project(table: string, row: Row, nodes: SelectNode[]): Row {
    const out: Row = {};
    for (const node of nodes) {
      if (node.kind === "star") Object.assign(out, row);
      else if (node.kind === "col") out[node.alias] = row[node.name] ?? null;
      else {
        const related = this.related(table, row, node.table);
        out[node.alias] = Array.isArray(related)
          ? related.map((r) => this.project(node.table, r, node.children))
          : related && this.project(node.table, related, node.children);
      }
    }
    return out;
  }
}

function safeJson(text: string | null | undefined) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

const b64url = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");

export function sessionFor(user: Row) {
  const exp = Math.floor(Date.now() / 1000) + 10 * 365 * 24 * 3600;
  const accessToken = [
    b64url({ alg: "HS256", typ: "JWT" }),
    b64url({ sub: user.id, email: user.email, role: "authenticated", aud: "authenticated", exp }),
    "e2e-signature",
  ].join(".");
  return {
    access_token: accessToken,
    token_type: "bearer",
    expires_in: exp - Math.floor(Date.now() / 1000),
    expires_at: exp,
    refresh_token: "e2e-refresh-token",
    user,
  };
}
