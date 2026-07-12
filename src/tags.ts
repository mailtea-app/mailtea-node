import type { RequestFn, ListResponse, DeletedResponse } from "./resource.js";
import { query } from "./resource.js";

export type TagSubscription = "opt_in" | "opt_out";
export type TagVisibility = "public" | "private";

export interface Tag {
  object: "tag";
  id: string;
  publication_id: string;
  name: string;
  description: string;
  default_subscription: TagSubscription;
  visibility: TagVisibility;
  created_at: string;
  updated_at: string;
}

export interface CreateTagInput {
  publication_id: string;
  name: string;
  default_subscription: TagSubscription;
  description?: string;
  visibility?: TagVisibility;
}

export interface UpdateTagInput {
  publication_id: string;
  name?: string;
  description?: string;
  default_subscription?: TagSubscription;
  visibility?: TagVisibility;
}

export interface ListTagsParams {
  publication_id: string;
  limit?: number;
  after?: string;
}

/** The `tags` resource. Access via `mailtea.tags`. */
export class Tags {
  constructor(private readonly request: RequestFn) {}

  /** Create a tag. */
  create(input: CreateTagInput): Promise<Tag> {
    return this.request<Tag>("POST", "/v1/tags", input);
  }

  /** List tags in a publication. */
  list(params: ListTagsParams): Promise<ListResponse<Tag>> {
    return this.request<ListResponse<Tag>>(
      "GET",
      `/v1/tags${query({ ...params })}`
    );
  }

  /** Retrieve a single tag. */
  get(id: string, params: { publication_id: string }): Promise<Tag> {
    return this.request<Tag>(
      "GET",
      `/v1/tags/${encodeURIComponent(id)}${query({ ...params })}`
    );
  }

  /** Update a tag. */
  update(id: string, input: UpdateTagInput): Promise<Tag> {
    // The tags API reads publication_id from the query string; the rest of the
    // fields go in the body.
    return this.request<Tag>(
      "PATCH",
      `/v1/tags/${encodeURIComponent(id)}${query({ publication_id: input.publication_id })}`,
      input
    );
  }

  /** Delete a tag. */
  delete(
    id: string,
    params: { publication_id: string }
  ): Promise<DeletedResponse> {
    return this.request<DeletedResponse>(
      "DELETE",
      `/v1/tags/${encodeURIComponent(id)}${query({ ...params })}`
    );
  }
}
