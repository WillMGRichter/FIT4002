/**
 * Test helper: a chainable fake of the Supabase query builder.
 *
 * Usage in a test file:
 *
 *   const mock = createSupabaseMock();
 *   jest.mock('../../config/supabase', () => ({ get supabase() { return mock.client; } }));
 *
 *   mock.queue('users', { data: { id: 'u1' } });      // result of the next from('users')
 *   await someService();
 *   expect(mock.opsOf(mock.calls[0], 'insert')[0]).toEqual([...]);
 *
 * Each `supabase.from(table)` call consumes the next queued result for that table
 * (FIFO per table). A `from()` for a table with nothing queued throws, so a test
 * fails loudly if the service makes an unexpected query - which also lets tests
 * assert that a code path did NOT touch the database.
 *
 * The builder is chainable (select/eq/order/...), `single()`/`maybeSingle()`
 * resolve to the result, and the builder itself is thenable so a query that is
 * awaited without a terminal call (e.g. `await q.insert(...)`) also resolves.
 */

export interface MockResult {
  data?: unknown;
  error?: unknown;
}

export interface RecordedOp {
  method: string;
  args: unknown[];
}

export interface RecordedCall {
  table: string;
  ops: RecordedOp[];
}

const CHAIN_METHODS = [
  'select', 'insert', 'upsert', 'update', 'delete',
  'eq', 'neq', 'in', 'is', 'order', 'limit', 'range',
] as const;

export function createSupabaseMock() {
  const queues = new Map<string, MockResult[]>();
  const calls: RecordedCall[] = [];
  const rpc = jest.fn();

  function queue(table: string, ...results: MockResult[]) {
    queues.set(table, [...(queues.get(table) ?? []), ...results]);
  }

  function from(table: string) {
    const next = queues.get(table)?.shift();
    if (!next) {
      throw new Error(`Unexpected supabase.from('${table}') - no result queued for it`);
    }
    const result = { data: null, error: null, ...next };
    const call: RecordedCall = { table, ops: [] };
    calls.push(call);

    const record = (method: string, args: unknown[]) => call.ops.push({ method, args });
    const builder: Record<string, unknown> = {};

    for (const method of CHAIN_METHODS) {
      builder[method] = (...args: unknown[]) => {
        record(method, args);
        return builder;
      };
    }
    for (const method of ['single', 'maybeSingle']) {
      builder[method] = () => {
        record(method, []);
        return Promise.resolve(result);
      };
    }
    builder.then = (
      resolve: (value: typeof result) => unknown,
      reject: (reason: unknown) => unknown
    ) => Promise.resolve(result).then(resolve, reject);

    return builder;
  }

  /** All argument lists passed to `method` on a recorded call, in order. */
  function opsOf(call: RecordedCall, method: string): unknown[][] {
    return call.ops.filter((o) => o.method === method).map((o) => o.args);
  }

  /** Reset recorded calls, queued results and rpc mock between tests. */
  function reset() {
    queues.clear();
    calls.length = 0;
    rpc.mockReset();
  }

  return { client: { from, rpc }, queue, calls, opsOf, rpc, reset };
}
