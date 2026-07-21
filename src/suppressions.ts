import type {
  RequestFn,
  TextRequestFn,
  ListResponse
} from "./resource.js";
import { query } from "./resource.js";

/**
 * Why an address is on the org-wide do-not-send list. Mirrors the canonical
 * `SUPPRESSION_REASONS` tuple in `@mailtea/contracts`.
 */
export type SuppressionReason =
  | "bounced"
  | "complained"
  | "manual"
  | "unsubscribed"
  | "invalid"
  | "unknown";

export interface Suppression {
  object: "suppression";
  id: string;
  email: string;
  reason: SuppressionReason;
  source: string;
  publication_id: string | null;
  created_at: string;
}

export interface ListSuppressionsParams {
  reason?: SuppressionReason;
  /** Free-text search over the email address. */
  q?: string;
  /** ISO 8601 lower bound on `created_at`. */
  created_after?: string;
  /** ISO 8601 upper bound on `created_at`. */
  created_before?: string;
  limit?: number;
  starting_after?: string;
}

export interface AddSuppressionsInput {
  emails: string[];
  reason?: SuppressionReason;
}

export interface RemoveSuppressionsInput {
  emails: string[];
}

/**
 * The `suppressions` resource — the org-wide do-not-send list. Team-scoped, so
 * no `publication_id`. Access via `mailtea.suppressions`.
 */
export class Suppressions {
  constructor(
    private readonly request: RequestFn,
    private readonly requestText: TextRequestFn
  ) {}

  /** List/search suppression entries for the caller's team. */
  list(params: ListSuppressionsParams = {}): Promise<ListResponse<Suppression>> {
    return this.request<ListResponse<Suppression>>(
      "GET",
      `/v1/suppressions${query({ ...params })}`
    );
  }

  /** Bulk-add suppression entries. Returns the number newly added. */
  add(input: AddSuppressionsInput): Promise<{ added: number }> {
    return this.request<{ added: number }>("POST", "/v1/suppressions", input);
  }

  /** Bulk-remove suppression entries. Returns the number removed. */
  remove(input: RemoveSuppressionsInput): Promise<{ removed: number }> {
    return this.request<{ removed: number }>(
      "DELETE",
      "/v1/suppressions",
      input
    );
  }

  /** Export every suppression entry as CSV text (`email,reason,source,created_at`). */
  export(): Promise<string> {
    return this.requestText("GET", "/v1/suppressions/export");
  }
}
