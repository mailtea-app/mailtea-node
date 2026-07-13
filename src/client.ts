import { Emails } from "./emails.js";
import { Contacts } from "./contacts.js";
import { Segments } from "./segments.js";
import { Tags } from "./tags.js";
import { Posts } from "./posts.js";
import { Domains } from "./domains.js";
import { Webhooks } from "./webhooks.js";
import { ContactProperties } from "./contact-properties.js";
import { ApiKeys } from "./api-keys.js";
import { MailteaError } from "./errors.js";

export interface MailteaOptions {
  /** API key (`mt_pat_...` or `mt_svc_...`). Falls back to `MAILTEA_API_KEY`. */
  apiKey?: string;
  /** API base URL. Defaults to `https://api.mailtea.app`. */
  baseUrl?: string;
  /** Custom `fetch` implementation. Defaults to the global `fetch`. */
  fetch?: typeof fetch;
}

const DEFAULT_BASE_URL = "https://api.mailtea.app";

function readEnvApiKey(): string | undefined {
  // Guard `process` so the SDK works in edge runtimes without Node globals.
  if (typeof process !== "undefined" && process.env) {
    return process.env.MAILTEA_API_KEY;
  }
  return undefined;
}

/**
 * The Mailtea client. Construct it with an API key, then use its resources:
 *
 * ```ts
 * import { Mailtea } from "mailtea-sdk";
 *
 * const mailtea = new Mailtea(process.env.MAILTEA_API_KEY);
 * const { id } = await mailtea.emails.send({
 *   from: "you@yourdomain.com",
 *   to: "recipient@example.com",
 *   subject: "Hello",
 *   html: "<p>Sent with Mailtea.</p>"
 * });
 * ```
 *
 * The API key can be passed as a string, inside an options object, or omitted
 * to read `MAILTEA_API_KEY` from the environment.
 */
export class Mailtea {
  /** The `emails` resource: send, batch, get, update, reschedule, cancel. */
  readonly emails: Emails;
  /** The `contacts` resource: create, list, get, update, delete. */
  readonly contacts: Contacts;
  /** The `segments` resource: create, list, get, update, delete. */
  readonly segments: Segments;
  /** The `tags` resource: create, list, get, update, delete. */
  readonly tags: Tags;
  /** The `posts` resource: sendTest (newsletter posts). */
  readonly posts: Posts;
  /** The `domains` resource: create, list, get, verify, update, delete. */
  readonly domains: Domains;
  /** The `webhooks` resource: create, list, get, update, delete. */
  readonly webhooks: Webhooks;
  /** The `contactProperties` resource: create, list, update, delete. */
  readonly contactProperties: ContactProperties;
  /** The `apiKeys` resource: create, list, revoke. */
  readonly apiKeys: ApiKeys;

  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(
    apiKeyOrOptions?: string | MailteaOptions,
    maybeOptions?: MailteaOptions
  ) {
    const options: MailteaOptions =
      typeof apiKeyOrOptions === "string"
        ? { ...maybeOptions, apiKey: apiKeyOrOptions }
        : (apiKeyOrOptions ?? maybeOptions ?? {});

    const apiKey = options.apiKey ?? readEnvApiKey();
    if (!apiKey) {
      throw new MailteaError(
        "Missing Mailtea API key. Pass it to `new Mailtea(apiKey)` or set the MAILTEA_API_KEY environment variable.",
        { status: 0, code: "missing_api_key" }
      );
    }

    const resolvedFetch = options.fetch ?? globalThis.fetch;
    if (typeof resolvedFetch !== "function") {
      throw new MailteaError(
        "No global `fetch` is available. Use Node.js 18+ (or Bun/Deno), or pass a `fetch` implementation in the Mailtea options.",
        { status: 0, code: "missing_fetch" }
      );
    }

    this.apiKey = apiKey;
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
    this.fetchImpl = resolvedFetch;
    const request = this.request.bind(this);
    this.emails = new Emails(request);
    this.contacts = new Contacts(request);
    this.segments = new Segments(request);
    this.tags = new Tags(request);
    this.posts = new Posts(request);
    this.domains = new Domains(request);
    this.webhooks = new Webhooks(request);
    this.contactProperties = new ContactProperties(request);
    this.apiKeys = new ApiKeys(request);
  }

  /** @internal Issue an authenticated request and map errors to MailteaError. */
  private async request<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey}`
    };
    if (body !== undefined) {
      headers["Content-Type"] = "application/json";
    }

    const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body)
    });

    const requestId = response.headers.get("x-request-id") ?? undefined;

    if (!response.ok) {
      let message = `${response.status} ${response.statusText}`.trim();
      let details: unknown;
      try {
        const errorBody = (await response.json()) as {
          error?: string;
          details?: unknown;
        } | null;
        if (errorBody?.error) message = errorBody.error;
        details = errorBody?.details;
      } catch {
        // Non-JSON error body — keep the status-line message.
      }
      throw new MailteaError(message, {
        status: response.status,
        details,
        requestId
      });
    }

    if (response.status === 204) {
      return undefined as T;
    }
    // Some endpoints (e.g. DELETE /v1/api-keys/:id) return 200 with an empty
    // body — tolerate that rather than throwing on a JSON parse of "".
    const text = await response.text();
    return (text ? (JSON.parse(text) as T) : (undefined as T));
  }
}
