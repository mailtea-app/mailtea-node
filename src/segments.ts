import type { RequestFn, ListResponse, DeletedResponse } from "./resource.js";
import { query } from "./resource.js";
import type { ContactStatus } from "./contacts.js";

export interface Segment {
  object: "segment";
  id: string;
  publication_id: string;
  name: string;
  description: string;
  status_filter: ContactStatus | null;
  query_filter: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateSegmentInput {
  publication_id: string;
  name: string;
  description?: string;
  status_filter?: ContactStatus;
  query_filter?: string;
}

export interface UpdateSegmentInput {
  publication_id: string;
  name?: string;
  description?: string;
  status_filter?: ContactStatus | null;
  query_filter?: string | null;
}

export interface ListSegmentsParams {
  publication_id: string;
  limit?: number;
  after?: string;
}

/** The `segments` resource. Access via `mailtea.segments`. */
export class Segments {
  constructor(private readonly request: RequestFn) {}

  /** Create a segment. */
  create(input: CreateSegmentInput): Promise<Segment> {
    return this.request<Segment>("POST", "/v1/segments", input);
  }

  /** List segments in a publication. */
  list(params: ListSegmentsParams): Promise<ListResponse<Segment>> {
    return this.request<ListResponse<Segment>>(
      "GET",
      `/v1/segments${query({ ...params })}`
    );
  }

  /** Retrieve a single segment. */
  get(id: string, params: { publication_id: string }): Promise<Segment> {
    return this.request<Segment>(
      "GET",
      `/v1/segments/${encodeURIComponent(id)}${query({ ...params })}`
    );
  }

  /** Update a segment. */
  update(id: string, input: UpdateSegmentInput): Promise<Segment> {
    // The segments API reads publication_id from the query string; the rest of
    // the fields go in the body.
    return this.request<Segment>(
      "PATCH",
      `/v1/segments/${encodeURIComponent(id)}${query({ publication_id: input.publication_id })}`,
      input
    );
  }

  /** Delete a segment. */
  delete(
    id: string,
    params: { publication_id: string }
  ): Promise<DeletedResponse> {
    return this.request<DeletedResponse>(
      "DELETE",
      `/v1/segments/${encodeURIComponent(id)}${query({ ...params })}`
    );
  }
}
