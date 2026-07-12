import type { RequestFn } from "./resource.js";

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
  /** `newsletter` (default, can publish to the site) or `broadcast` (email-only). */
  kind?: "newsletter" | "broadcast";
  /** Send right after creating (requires the `issues:send` scope). */
  send?: boolean;
  /** ISO-8601; with `send`, schedules the send instead of sending now. */
  scheduled_at?: string;
}

/** Result of `posts.create`. */
export interface CreatePostResult {
  /** The new post's id. */
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
}
