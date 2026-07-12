import type {
  SendEmailInput,
  BatchEmailInput,
  UpdateEmailInput,
  SendEmailResponse,
  BatchEmailResponse,
  UpdateEmailResponse,
  CancelEmailResponse,
  RetrievedEmail,
  EmailListResponse,
  ListEmailsParams,
  EmailAnalytics,
  EmailAnalyticsParams
} from "./types.js";
import type { RequestFn } from "./resource.js";
import { query } from "./resource.js";
import { InboundEmails } from "./inbound.js";

export type { RequestFn };

/**
 * The `emails` resource. Access via `mailtea.emails`.
 */
export class Emails {
  /** Inbound (received) emails: list, get, reply, and attachments. */
  readonly inbound: InboundEmails;

  constructor(private readonly request: RequestFn) {
    this.inbound = new InboundEmails(request);
  }

  /**
   * Send a transactional email.
   *
   * Provide either inline content (`html` and/or `text`) **or** a `template`
   * reference — not both. `to`, `cc`, `bcc`, and `reply_to` each accept a single
   * address or an array.
   *
   * @returns the new email's `id`.
   */
  async send(payload: SendEmailInput): Promise<SendEmailResponse> {
    return this.request<SendEmailResponse>("POST", "/v1/emails", payload);
  }

  /**
   * Send up to 100 emails in a single request. Batch items do not support
   * `attachments` or `scheduled_at`.
   *
   * @returns `{ data: [{ id }, ...] }` in request order.
   */
  async batch(payload: BatchEmailInput): Promise<BatchEmailResponse> {
    return this.request<BatchEmailResponse>(
      "POST",
      "/v1/emails/batch",
      payload
    );
  }

  /**
   * List transactional emails (most recent first), optionally filtered by
   * status, tags, or a `created_at` date range, and offset-paginated.
   *
   * @returns `{ data, total, limit, offset, has_more }`.
   */
  async list(params: ListEmailsParams = {}): Promise<EmailListResponse> {
    return this.request<EmailListResponse>("GET", `/v1/emails${query({ ...params })}`);
  }

  /**
   * Aggregate transactional metrics over an optional date window: totals,
   * delivered/bounced/open/click counts, per-status counts, and rates.
   */
  async analytics(params: EmailAnalyticsParams = {}): Promise<EmailAnalytics> {
    return this.request<EmailAnalytics>("GET", `/v1/emails/analytics${query({ ...params })}`);
  }

  /**
   * Retrieve a single email with its current delivery status and tracking
   * counters. The returned object exposes both `last_event` (the raw wire field)
   * and a friendly `status` alias.
   */
  async get(id: string): Promise<RetrievedEmail> {
    const email = await this.request<RetrievedEmail>(
      "GET",
      `/v1/emails/${encodeURIComponent(id)}`
    );
    return { ...email, status: email.status ?? email.last_event ?? null };
  }

  /**
   * Update a scheduled email — currently only its `scheduled_at`. Only emails
   * still in the `scheduled` state can be updated.
   */
  async update(
    id: string,
    payload: UpdateEmailInput
  ): Promise<UpdateEmailResponse> {
    return this.request<UpdateEmailResponse>(
      "PATCH",
      `/v1/emails/${encodeURIComponent(id)}`,
      payload
    );
  }

  /**
   * Convenience wrapper over {@link Emails.update} for the common reschedule
   * case.
   *
   * @param scheduledAt ISO 8601 datetime string.
   */
  async reschedule(
    id: string,
    scheduledAt: string
  ): Promise<UpdateEmailResponse> {
    return this.update(id, { scheduled_at: scheduledAt });
  }

  /** Cancel a scheduled email before it sends. */
  async cancel(id: string): Promise<CancelEmailResponse> {
    return this.request<CancelEmailResponse>(
      "POST",
      `/v1/emails/${encodeURIComponent(id)}/cancel`
    );
  }
}
