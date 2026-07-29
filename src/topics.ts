import type { RequestFn, ListResponse, DeletedResponse } from "./resource.js";
import { query } from "./resource.js";

export type TopicSubscription = "opt_in" | "opt_out";
export type TopicVisibility = "public" | "private";

export interface Topic {
  object: "topic";
  id: string;
  publication_id: string;
  name: string;
  description: string;
  default_subscription: TopicSubscription;
  visibility: TopicVisibility;
  created_at: string;
  updated_at: string;
}

export interface CreateTopicInput {
  publication_id: string;
  name: string;
  default_subscription: TopicSubscription;
  description?: string;
  visibility?: TopicVisibility;
}

export interface UpdateTopicInput {
  publication_id: string;
  name?: string;
  description?: string;
  default_subscription?: TopicSubscription;
  visibility?: TopicVisibility;
}

export interface ListTopicsParams {
  publication_id: string;
  limit?: number;
  after?: string;
}

/** The `topics` resource. Access via `mailtea.topics`. */
export class Topics {
  constructor(private readonly request: RequestFn) {}

  /** Create a topic. */
  create(input: CreateTopicInput): Promise<Topic> {
    return this.request<Topic>("POST", "/v1/topics", input);
  }

  /** List topics in a publication. */
  list(params: ListTopicsParams): Promise<ListResponse<Topic>> {
    return this.request<ListResponse<Topic>>(
      "GET",
      `/v1/topics${query({ ...params })}`
    );
  }

  /** Retrieve a single topic. */
  get(id: string, params: { publication_id: string }): Promise<Topic> {
    return this.request<Topic>(
      "GET",
      `/v1/topics/${encodeURIComponent(id)}${query({ ...params })}`
    );
  }

  /** Update a topic. */
  update(id: string, input: UpdateTopicInput): Promise<Topic> {
    // The topics API reads publication_id from the query string; the rest of the
    // fields go in the body.
    return this.request<Topic>(
      "PATCH",
      `/v1/topics/${encodeURIComponent(id)}${query({ publication_id: input.publication_id })}`,
      input
    );
  }

  /** Delete a topic. */
  delete(
    id: string,
    params: { publication_id: string }
  ): Promise<DeletedResponse> {
    return this.request<DeletedResponse>(
      "DELETE",
      `/v1/topics/${encodeURIComponent(id)}${query({ ...params })}`
    );
  }
}
