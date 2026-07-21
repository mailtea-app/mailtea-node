import type { RequestFn, DeletedResponse } from "./resource.js";
import { query } from "./resource.js";

export type PostStatus = "draft" | "scheduled" | "sending" | "sent" | "failed";

/** A newsletter post (issue). Returned by `posts.list`, `posts.get`. */
export interface Post {
  object: "post";
  id: string;
  publication_id: string;
  name: string;
  subject: string;
  status: PostStatus;
  html: string | null;
  text: string | null;
  created_at: string;
  scheduled_at: string | null;
  sent_at: string | null;
}

/** Input for `posts.sendTest`. */
export interface SendPostTestInput {
  /** Up to 10 test recipients (yourself / teammates). */
  recipients: string[];
  /** Sender, e.g. `"Acme <hello@acme.com>"`. Must use a verified domain. */
  from: string;
  reply_to?: string;
}

/** Result of `posts.sendTest`. */
export interface PostTestSendResult {
  object: "test_send";
  id: string;
  sent_at: string;
  from: string;
  sent_to: string[];
  failed_to: Array<{ address: string; reason: string }>;
}

/** Input for `posts.create`. */
export interface CreatePostInput {
  /** Publication the post belongs to. */
  publication_id: string;
  /** Subject line (also the post's working title). */
  subject: string;
  /**
   * Seed the post from a published server template (see the `templates` tools).
   * Provide this OR `html` — not both. `{{variables}}` are substituted.
   */
  template_id?: string;
  /** Values substituted into the template's `{{variable}}` placeholders. */
  variables?: Record<string, string | number>;
  /** Inline HTML body (use this OR `template_id`). */
  html?: string;
  /** Inline plain-text body. */
  text?: string;
  /** From header, e.g. `Acme <hello@acme.com>`. Must use a verified domain. */
  from?: string;
  reply_to?: string;
  /** Internal name/working title (defaults to `subject`). */
  name?: string;
  /** `newsletter` (default, can publish to the site) or `broadcast` (email-only). */
  kind?: "newsletter" | "broadcast";
  /** Send right after creating (requires the `issues:send` scope). */
  send?: boolean;
  /** ISO-8601; with `send`, schedules the send instead of sending now. */
  scheduled_at?: string;
}

/** Filters + offset pagination for `posts.list`. */
export interface ListPostsParams {
  publication_id: string;
  limit?: number;
  offset?: number;
  status?: PostStatus;
  kind?: "newsletter" | "broadcast";
}

/** Offset-paginated list returned by `posts.list`. */
export interface PostListResponse {
  data: Post[];
  total: number;
}

/** Input for `posts.update` (draft posts only). */
export interface UpdatePostInput {
  subject?: string;
  html?: string;
  text?: string;
  from?: string;
  reply_to?: string;
  name?: string;
}

/** Result of `posts.update`. */
export interface UpdatePostResult {
  object: "post";
  id: string;
}

/** Result of `posts.create`. */
export interface CreatePostResult {
  /** The new post's id. */
  id: string;
}

/** Input for `posts.send`. */
export interface SendPostInput {
  /** ISO-8601; schedules the send instead of sending now. */
  scheduled_at?: string;
}

/** Result of `posts.send`. */
export interface SendPostResult {
  object: "post";
  id: string;
}

/**
 * The `posts` resource (newsletter posts/issues). Access via `mailtea.posts`.
 */
export class Posts {
  constructor(private readonly request: RequestFn) {}

  /**
   * Create a newsletter post (draft by default). Seed it from a published
   * server template with `template_id` + `variables`, or pass inline `html`.
   * Set `send: true` to deliver immediately (or with `scheduled_at` to
   * schedule) — that requires the `issues:send` scope. Returns `{ id }`.
   */
  create(input: CreatePostInput): Promise<CreatePostResult> {
    return this.request<CreatePostResult>("POST", "/v1/posts", input);
  }

  /**
   * List posts in a publication (most recent first), optionally filtered by
   * `status` or `kind`, and offset-paginated. Returns `{ data, total }`.
   */
  list(params: ListPostsParams): Promise<PostListResponse> {
    return this.request<PostListResponse>(
      "GET",
      `/v1/posts${query({ ...params })}`
    );
  }

  /** Retrieve a single post. */
  get(id: string): Promise<Post> {
    return this.request<Post>("GET", `/v1/posts/${encodeURIComponent(id)}`);
  }

  /** Update a draft post. Only posts still in the `draft` state can be updated. */
  update(id: string, input: UpdatePostInput): Promise<UpdatePostResult> {
    return this.request<UpdatePostResult>(
      "PATCH",
      `/v1/posts/${encodeURIComponent(id)}`,
      input
    );
  }

  /**
   * Send a draft post to the publication's audience — immediately, or at
   * `scheduled_at` (ISO-8601) if given. Requires the `issues:send` scope.
   * Returns `{ id }`.
   */
  send(id: string, input?: SendPostInput): Promise<SendPostResult> {
    return this.request<SendPostResult>(
      "POST",
      `/v1/posts/${encodeURIComponent(id)}/send`,
      input
    );
  }

  /**
   * Send a TEST copy of a post to specific recipients to check it before
   * subscribers see it. Renders the post exactly as a subscriber would receive
   * it and delivers a one-shot `[TEST]` email — it does NOT send to the
   * audience. Returns `{ sent_to, failed_to }`.
   */
  sendTest(id: string, input: SendPostTestInput): Promise<PostTestSendResult> {
    return this.request<PostTestSendResult>(
      "POST",
      `/v1/posts/${encodeURIComponent(id)}/test`,
      input
    );
  }

  /** Delete a draft post. Only posts still in the `draft` state can be deleted. */
  delete(id: string): Promise<DeletedResponse> {
    return this.request<DeletedResponse>(
      "DELETE",
      `/v1/posts/${encodeURIComponent(id)}`
    );
  }
}
