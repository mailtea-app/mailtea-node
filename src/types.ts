// Request wire types. These are kept self-contained (no runtime deps) so the
// published `mailtea` package pulls nothing extra. They mirror the `@mailtea/
// contracts` schemas exactly; `contracts-parity.test.ts` enforces that at
// compile time so they can never silently drift from the API's validation.

/** A stored-template reference, used in place of inline `html`/`text`. */
export interface TemplateRef {
  id: string;
  variables?: Record<string, string | number>;
}

/** Input for `emails.send`. Provide inline content (`html`/`text`) OR a `template`.
 *  Provide exactly one of `from` or `sender_id`. */
export interface SendEmailInput {
  /** From header, e.g. `Acme <hello@acme.com>`. Mutually exclusive with `sender_id`. */
  from?: string;
  /** A verified publication sender to send as. Mutually exclusive with `from`. */
  sender_id?: string;
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  template?: TemplateRef;
  cc?: string | string[];
  bcc?: string | string[];
  reply_to?: string | string[];
  /** ISO 8601 datetime to schedule the send. */
  scheduled_at?: string;
  tags?: Array<{ name: string; value: string }>;
  headers?: Record<string, string>;
  attachments?: Array<{
    filename: string;
    /** Base64-encoded file content. */
    content: string;
    content_type?: string;
    content_id?: string;
  }>;
}

/** One item in an `emails.batch` call — like `SendEmailInput` minus
 *  attachments/scheduling. Batch items require an explicit `from` (sender_id is
 *  single-send only). */
export type BatchEmailItemInput = Omit<
  SendEmailInput,
  "attachments" | "scheduled_at" | "sender_id" | "from"
> & { from: string };

/** Input for `emails.batch` (1–100 items). */
export type BatchEmailInput = BatchEmailItemInput[];

/** Input for `emails.update` — currently only a reschedule. */
export interface UpdateEmailInput {
  scheduled_at: string;
}

export interface SendEmailResponse {
  id: string;
}

export interface BatchEmailResponse {
  data: { id: string }[];
}

export interface UpdateEmailResponse {
  object: "email";
  id: string;
}

export interface CancelEmailResponse {
  object: "email";
  id: string;
}

/**
 * Email lifecycle status. Mirrors the API's `last_event`. The open string union
 * keeps autocomplete for known values while tolerating new ones.
 */
export type EmailStatus =
  | "queued"
  | "scheduled"
  | "sent"
  | "delivered"
  | "delivery_delayed"
  | "bounced"
  | "complained"
  | "failed"
  | "suppressed"
  | "canceled"
  // eslint-disable-next-line @typescript-eslint/ban-types
  | (string & {});

export interface EmailTag {
  name: string;
  value: string;
}

export interface EmailAttachmentMeta {
  filename: string;
  content_type: string;
  size: number;
}

/**
 * Shape returned by `emails.get(id)`. Date fields are ISO 8601 strings on the
 * wire. `status` is a friendly alias the SDK derives from `last_event`.
 */
export interface RetrievedEmail {
  object: "email";
  id: string;
  from: string | null;
  to: string | null;
  cc: string | null;
  bcc: string | null;
  reply_to: string | null;
  subject: string;
  html: string | null;
  text: string | null;
  created_at: string | null;
  scheduled_at: string | null;
  /** Most recent delivery event (the raw API wire field). */
  last_event: EmailStatus | null;
  /** Friendly alias of `last_event`. */
  status: EmailStatus | null;
  delayed_at: string | null;
  opened_at: string | null;
  open_count: number;
  clicked_at: string | null;
  click_count: number;
  tags: EmailTag[] | null;
  headers: Record<string, string> | null;
  attachments: EmailAttachmentMeta[];
}

/** A lightweight email row returned by `emails.list` (no body/attachments). */
export interface EmailListItem {
  object: "email";
  id: string;
  from: string | null;
  to: string | null;
  subject: string;
  created_at: string | null;
  scheduled_at: string | null;
  last_event: EmailStatus | null;
  open_count: number;
  click_count: number;
  tags: EmailTag[] | null;
}

/** Filters + offset pagination for `emails.list`. */
export interface ListEmailsParams {
  status?: EmailStatus;
  tag_name?: string;
  tag_value?: string;
  /** Case-insensitive substring match on recipient, sender, or subject. */
  search?: string;
  /** ISO 8601 lower bound on `created_at`. */
  from_date?: string;
  /** ISO 8601 upper bound on `created_at`. */
  to_date?: string;
  /** Max results, 1–100 (default 50). */
  limit?: number;
  offset?: number;
}

/** Offset-paginated list returned by `emails.list`. */
export interface EmailListResponse {
  object: "list";
  data: EmailListItem[];
  total: number;
  limit: number;
  offset: number;
  has_more: boolean;
}

/** Optional date window for `emails.analytics`. */
export interface EmailAnalyticsParams {
  /** ISO 8601 lower bound on `created_at`. */
  from_date?: string;
  /** ISO 8601 upper bound on `created_at`. */
  to_date?: string;
}

/** Aggregate transactional metrics returned by `emails.analytics`. */
export interface EmailAnalytics {
  object: "analytics";
  from_date: string | null;
  to_date: string | null;
  /** Emails created in the window. */
  total: number;
  /** Emails dispatched to the provider (total minus queued/scheduled/canceled); the rate denominator. */
  sent: number;
  delivered: number;
  bounced: number;
  /** Distinct emails with at least one open / click. */
  opened: number;
  clicked: number;
  /** Sum of open / click events. */
  total_opens: number;
  total_clicks: number;
  status_counts: Record<string, number>;
  rates: {
    /** delivered / sent */
    delivery_rate: number;
    /** bounced / sent */
    bounce_rate: number;
    /** opened / sent */
    open_rate: number;
    /** clicked / sent */
    click_rate: number;
  };
}
