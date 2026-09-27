import type { RequestFn, DeletedResponse } from "./resource.js";
import { query } from "./resource.js";

export type PostStatus = "draft" | "scheduled" | "sending" | "sent" | "failed";

/** A newsletter post (issue). Returned by `posts.list`, `posts.get`. */
export interface Post {
  object: "post";
  id: string;
  publication_id: string;
  /**
   * Internal name in Mailtea Studio. Separate from `subject`: renaming a post
   * never changes what subscribers see. Equals `subject` when not set.
   */
  name: string;
  /** The subject line subscribers see. */
  subject: string;
  /**
   * The From set on this post, or `null` when the named sender or the
   * publication default decides. A From on the built-in `*.mailtea.email`
   * address is kept for test emails, but the post sends from the default sender.
   */
  from: string | null;
  /** The Reply-To set on this post, or `null` when the sender's applies. */
  reply_to: string | null;
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
  /** Subject line (also the post's working title). Always this value, even
   *  when seeding from `template_id`: the template's own subject line is
   *  never copied in. */
  subject: string;
  /**
   * Seed the post from a published server template (see the `templates` tools),
   * using its PUBLISHED version, not any unpublished edits saved since. Provide
   * this OR `html`, not both. The `variables` you pass are filled in, in both
   * the `{{key}}` and Visual Email Designer `{key}` forms. Everything else is
   * left for the broadcast to fill per recipient: a declared variable you do
   * not pass keeps its `fallback_value` for recipients with no value, and
   * undeclared tokens like `{{contact.first_name}}` are left as they are. The
   * post keeps the template's published page style; it is wrapped in that
   * page, and its show-if blocks are decided per recipient, when it is sent. The template's preview text
   * (preheader) is part of its rendered HTML, so it does reach the inbox, but
   * the post's own preview text field stays empty.
   */
  template_id?: string;
  /** Values substituted into the template's variable placeholders (both the
   *  `{{key}}` and Visual Email Designer `{key}` forms). HTML-escaped; use
   *  `{{{key}}}` in the template to insert raw HTML instead. */
  variables?: Record<string, string | number>;
  /** Inline HTML body (use this OR `template_id`). */
  html?: string;
  /** Inline plain-text body. */
  text?: string;
  /**
   * From header, e.g. `Acme <hello@acme.com>`. Must be on one of the
   * publication's verified sending domains, or the request is refused with a
   * 422. A From on the built-in `*.mailtea.email` address is kept for test
   * emails, but the post itself sends from the publication's default sender.
   * Kept on the post and returned by `posts.get`.
   */
  from?: string;
  /** Reply-To address (a valid email, any domain). Replaces the sender's. */
  reply_to?: string;
  /**
   * Internal name in Mailtea Studio. Never used as the subject: renaming a post
   * never changes what subscribers see. Defaults to following `subject`.
   */
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

/**
 * Input for `posts.update` (draft posts only). Only the fields you pass change.
 */
export interface UpdatePostInput {
  /** The subject line subscribers see. */
  subject?: string;
  html?: string;
  text?: string;
  /**
   * From header, gated like `posts.create` (422 when the domain is not
   * verified). `""` clears it, so the named sender or publication default decides.
   */
  from?: string;
  /** Reply-To address (a valid email). `""` clears it. */
  reply_to?: string;
  /** Internal name. Never changes the subject. `""` clears it (follows the subject). */
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
