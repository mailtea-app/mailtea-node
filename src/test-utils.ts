// Test-only helpers. Not exported from the package entry (`index.ts`) and never
// bundled — `tsup` only builds what `index.ts` imports.

export interface RecordedRequest {
  url: string;
  method: string;
  headers: Headers;
  body: string | null;
}

export interface MockResponseSpec {
  status?: number;
  json?: unknown;
  rawBody?: string;
  headers?: Record<string, string>;
}

export interface MockFetch {
  fetch: typeof fetch;
  calls: RecordedRequest[];
}

/**
 * Build a `fetch` stand-in that records every request and replies with a
 * constant (or per-request) response.
 */
export function createMockFetch(
  spec: MockResponseSpec | ((req: RecordedRequest) => MockResponseSpec)
): MockFetch {
  const calls: RecordedRequest[] = [];
  const fetchImpl = (async (input: unknown, init?: RequestInit) => {
    const record: RecordedRequest = {
      url: String(input),
      method: init?.method ?? "GET",
      headers: new Headers(init?.headers ?? undefined),
      body: typeof init?.body === "string" ? init.body : null
    };
    calls.push(record);
    const resolved = typeof spec === "function" ? spec(record) : spec;
    const status = resolved.status ?? 200;
    const headers = {
      "content-type": "application/json",
      ...(resolved.headers ?? {})
    };
    const bodyText =
      resolved.rawBody ??
      (resolved.json === undefined ? null : JSON.stringify(resolved.json));
    return new Response(bodyText, { status, headers });
  }) as unknown as typeof fetch;
  return { fetch: fetchImpl, calls };
}

/** Read a recorded call, asserting it exists (keeps `noUncheckedIndexedAccess` happy). */
export function requireCall(calls: RecordedRequest[], index: number): RecordedRequest {
  const call = calls[index];
  if (!call) {
    throw new Error(`Expected a recorded request at index ${index}, found none`);
  }
  return call;
}
