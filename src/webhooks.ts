import type { RequestFn, ListResponse, DeletedResponse } from "./resource.js";
import { query } from "./resource.js";

export type WebhookStatus = "enabled" | "disabled";

export type WebhookEvent =
  | "email.received"
  | "email.sent"
  | "email.delivered"
  | "email.delivery_delayed"
  | "email.bounced"
  | "email.complained"
  | "email.opened"
  | "email.clicked"
  | "email.failed"
  | "email.suppressed"
  | "contact.created"
  | "contact.updated"
  | "contact.deleted"
  | "contact.unsubscribed";

export interface Webhook {
  object: "webhook";
  id: string;
  publication_id: string;
  endpoint: string;
  events: WebhookEvent[];
  /** Returned only on create — store it to verify payload signatures. */
  signing_secret?: string;
  status: WebhookStatus;
  created_at: string;
  updated_at: string;
}

export interface CreateWebhookInput {
  publication_id: string;
  endpoint: string;
  events: WebhookEvent[];
}

export interface UpdateWebhookInput {
  publication_id: string;
  endpoint?: string;
  events?: WebhookEvent[];
  status?: WebhookStatus;
}

export interface ListWebhooksParams {
  publication_id: string;
  limit?: number;
  after?: string;
}

const BASE = "/v1/webhooks/endpoints";

/**
 * The `webhooks` resource (outbound event subscriptions). Access via
 * `mailtea.webhooks`. `create()` returns the `signing_secret` once.
 */
export class Webhooks {
  constructor(private readonly request: RequestFn) {}

  /** Create a webhook. The response `signing_secret` is returned only once. */
  create(input: CreateWebhookInput): Promise<Webhook> {
    return this.request<Webhook>("POST", BASE, input);
  }

  /** List webhooks in a publication (signing secrets omitted). */
  list(params: ListWebhooksParams): Promise<ListResponse<Webhook>> {
    return this.request<ListResponse<Webhook>>(
      "GET",
      `${BASE}${query({ ...params })}`
    );
  }

  /** Retrieve a single webhook. */
  get(id: string, params: { publication_id: string }): Promise<Webhook> {
    return this.request<Webhook>(
      "GET",
      `${BASE}/${encodeURIComponent(id)}${query({ ...params })}`
    );
  }

  /** Update a webhook's endpoint, events, or enabled/disabled status. */
  update(id: string, input: UpdateWebhookInput): Promise<Webhook> {
    return this.request<Webhook>(
      "PATCH",
      `${BASE}/${encodeURIComponent(id)}${query({ publication_id: input.publication_id })}`,
      input
    );
  }

  /** Delete a webhook. */
  delete(
    id: string,
    params: { publication_id: string }
  ): Promise<DeletedResponse> {
    return this.request<DeletedResponse>(
      "DELETE",
      `${BASE}/${encodeURIComponent(id)}${query({ ...params })}`
    );
  }
}
