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
  /**
   * The inactivity filter: contacts with no open or click in the last N days,
   * or `null` when the segment has none. See `CreateSegmentInput.inactive_days`.
   */
  inactive_days: number | null;
  created_at: string;
  updated_at: string;
}

export interface CreateSegmentInput {
  publication_id: string;
  name: string;
  description?: string;
  status_filter?: ContactStatus;
  query_filter?: string;
  /**
   * Select contacts with no open or click in the last N days (an integer, 1 to
   * 3650). A contact who never engaged counts as inactive, so this finds the
   * silent cohort for a sunset or re-engagement send; it is not an "engaged
   * readers" filter. Engagement tracking is not backfilled, so contacts with
   * no recorded engagement count as inactive, including some who opened or
   * clicked before tracking began. Setting it makes the
   * segment a filter segment; with `status_filter` or `query_filter`, a contact
   * must match all of them.
   */
  inactive_days?: number;
}

export interface UpdateSegmentInput {
  publication_id: string;
  name?: string;
  description?: string;
  status_filter?: ContactStatus | null;
  query_filter?: string | null;
  /** See `CreateSegmentInput.inactive_days`. `null` clears it; omit it to leave
   *  it unchanged. A segment with contacts added to it cannot take a filter. */
  inactive_days?: number | null;
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

  /**
   * Delete a segment. A segment that a draft, scheduled or sending post
   * targets cannot be deleted: it fails with a 409 `MailteaError` (`code`
   * `segment_in_use`) and nothing is deleted. Point those posts at another
   * segment, or set their `segment_id` to `null`, first.
   */
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
