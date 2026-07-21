export type RequestFn = <T>(
  method: string,
  path: string,
  body?: unknown,
  headers?: Record<string, string>
) => Promise<T>;

/**
 * Like {@link RequestFn} but returns the raw response body as text instead of
 * JSON-parsing it — used by endpoints that reply with `text/csv` rather than
 * JSON (e.g. `GET /v1/suppressions/export`).
 */
export type TextRequestFn = (method: string, path: string) => Promise<string>;

/** Standard list-response envelope used by the audience endpoints. */
export interface ListResponse<T> {
  object: "list";
  data: T[];
  has_more: boolean;
  next_cursor?: string;
}

/** Standard delete-response envelope. */
export interface DeletedResponse {
  object: string;
  id: string;
  deleted: true;
}

/** Build a `?a=1&b=2` query string, skipping empty/undefined values. */
export function query(
  params: Record<string, string | number | undefined | null>
): string {
  const entries = Object.entries(params).filter(
    ([, v]) => v !== undefined && v !== null && v !== ""
  );
  if (entries.length === 0) return "";
  return (
    "?" +
    entries
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
      .join("&")
  );
}
