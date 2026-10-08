// Supabase's API caps every response at the project's "Max rows" setting
// (1,000 by default) and silently drops the rest — no error, just a short
// list. Any query that can grow past that (e.g. a coach's full lesson
// history) has to page through with .range() instead of one select.
//
// The query passed in must have a deterministic order (end with a unique
// column such as id) or rows can repeat/skip across page boundaries.
const PAGE_SIZE = 1000;

export async function fetchAllRows<T = any>(
  buildPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: any }>
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await buildPage(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) return rows;
  }
}
