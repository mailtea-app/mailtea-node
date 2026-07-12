export type RequestFn = <T>(
  method: string,
  path: string,
  body?: unknown
) => Promise<T>;

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
