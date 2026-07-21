import type { RequestFn, ListResponse, DeletedResponse } from "./resource.js";
import { query } from "./resource.js";

export interface Sender {
  object: "sender";
  id: string;
  publication_id: string;
  name: string;
  email: string;
  reply_to: string | null;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateSenderInput {
  publication_id: string;
  name: string;
  email: string;
  reply_to?: string | null;
  is_default?: boolean;
}

/** Update a sender. The `email` is immutable — only `name`, `reply_to`, and
 *  `is_default` can change. */
export interface UpdateSenderInput {
  publication_id: string;
  name?: string;
  reply_to?: string | null;
  is_default?: boolean;
}

export interface ListSendersParams {
  publication_id: string;
  limit?: number;
  after?: string;
}

/**
 * The `senders` resource (publication sending identities). Access via
 * `mailtea.senders`.
 */
export class Senders {
  constructor(private readonly request: RequestFn) {}

  /** List senders in a publication. */
  list(params: ListSendersParams): Promise<ListResponse<Sender>> {
    return this.request<ListResponse<Sender>>(
      "GET",
      `/v1/senders${query({ ...params })}`
    );
  }

  /** Create a sender. Its `email` must use a verified, DKIM-verified domain. */
  create(input: CreateSenderInput): Promise<Sender> {
    return this.request<Sender>("POST", "/v1/senders", input);
  }

  /** Retrieve a single sender. */
  get(id: string, params: { publication_id: string }): Promise<Sender> {
    return this.request<Sender>(
      "GET",
      `/v1/senders/${encodeURIComponent(id)}${query({ ...params })}`
    );
  }

  /** Update a sender (`email` is immutable). */
  update(id: string, input: UpdateSenderInput): Promise<Sender> {
    // The senders API reads publication_id from the body alongside the rest of
    // the fields.
    return this.request<Sender>(
      "PATCH",
      `/v1/senders/${encodeURIComponent(id)}`,
      input
    );
  }

  /** Delete a sender. */
  delete(
    id: string,
    params: { publication_id: string }
  ): Promise<DeletedResponse> {
    return this.request<DeletedResponse>(
      "DELETE",
      `/v1/senders/${encodeURIComponent(id)}${query({ ...params })}`
    );
  }
}
