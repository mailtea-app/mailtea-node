export interface MailteaErrorInit {
  /** HTTP status code, or `0` for client-side errors raised before a request. */
  status: number;
  /** Machine-readable code, when available (e.g. `missing_api_key`). */
  code?: string;
  /** Structured error payload from the API (e.g. Zod validation issues on 400). */
  details?: unknown;
  /** Value of the `x-request-id` response header, useful for support. */
  requestId?: string;
}

/**
 * Error thrown by the Mailtea SDK for both client-side problems (missing API
 * key, no `fetch`) and non-2xx API responses. Inspect `status` and `details`
 * to branch on validation vs. auth vs. not-found errors.
 */
export class MailteaError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly details?: unknown;
  readonly requestId?: string;

  constructor(message: string, init: MailteaErrorInit) {
    super(message);
    this.name = "MailteaError";
    this.status = init.status;
    this.code = init.code;
    this.details = init.details;
    this.requestId = init.requestId;
    // Preserve `instanceof MailteaError` across transpilation/runtime targets.
    Object.setPrototypeOf(this, MailteaError.prototype);
  }
}
