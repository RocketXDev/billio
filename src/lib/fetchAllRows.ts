// Supabase's API caps every response at the project's "Max rows" setting
// (1,000 by default) and silently drops the rest — no error, just a short
// list. Any query that can grow past that (e.g. a coach's full lesson
// history) has to page through with .range() instead of one select.
//
// Each page asks for PAGE_SIZE rows, but the cap may hand back fewer, so the
// next page starts after the rows actually received, and only an empty page
// means the end. That keeps this correct whatever "Max rows" is set to, at
// the cost of one extra (empty) request per load.
//
// The query passed in must have a deterministic order (end with a unique
// column such as id) or rows can repeat/skip across page boundaries.
const PAGE_SIZE = 1000;

export async function fetchAllRows<T = any>(
  buildPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: any }>
): Promise<T[]> {
  const rows: T[] = [];
  for (;;) {
    const from = rows.length;
    const { data, error } = await buildPage(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    if (!data || data.length === 0) return rows;
    rows.push(...data);
  }
}
