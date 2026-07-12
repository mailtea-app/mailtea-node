import type { RequestFn, ListResponse } from "./resource.js";
import { query } from "./resource.js";

// Wire types for the inbound (received) email resource. Kept self-contained (no
// runtime deps) so the published `mailtea` package pulls nothing extra. They
// mirror the REST DTOs in `apps/api/src/inbound-rest.ts`; `InboundReplyInput`
// additionally stays in parity with `@mailtea/contracts` (enforced at typecheck
// in `contracts-parity.test.ts`).

/** A lightweight inbound-email row returned by `emails.inbound.list` (no body/attachments). */
export interface InboundEmailListItem {
  /** Inbound email id (`rxemail_…`). */
  id: string;
  from: string;
  to: string[];
  cc: string[];
  bcc: string[];
  reply_to: string[];
  subject: string;
  message_id: string | null;
  created_at: string;
}

/** Attachment metadata embedded in {@link RetrievedInboundEmail} (no download URL). */
export interface InboundAttachmentMeta {
  /** Attachment id (`rxatt_…`). */
  id: string;
  filename: string;
  content_type: string;
  content_disposition: string | null;
  content_id: string | null;
  size: number;
}

/** Shape returned by `emails.inbound.get(id)`. Date fields are ISO 8601 strings on the wire. */
export interface RetrievedInboundEmail {
  object: "email";
  /** Inbound email id (`rxemail_…`). */
  id: string;
  from: string;
  to: string[];
  cc: string[];
  bcc: string[];
  reply_to: string[];
  subject: string;
  message_id: string | null;
  in_reply_to: string | null;
  references: string[];
  html: string | null;
  text: string | null;
  headers: Record<string, string> | null;
  created_at: string;
  /** Short-lived signed URL to download the raw RFC 822 message. */
  raw: { download_url: string; expires_at: string };
  attachments: InboundAttachmentMeta[];
}

/**
 * A downloadable inbound attachment, returned by `emails.inbound.attachments`.
 * `object` is present on `get` and omitted from `list` rows.
 */
export interface InboundAttachment {
  object?: "attachment";
  /** Attachment id (`rxatt_…`). */
  id: string;
  filename: string;
  content_type: string;
  content_disposition: string | null;
  content_id: string | null;
  size: number;
  /** Short-lived signed URL to download the file; expires at `expires_at`. */
  download_url: string;
  expires_at: string;
}

/** Cursor pagination for `emails.inbound.list`. */
export interface ListInboundEmailsParams {
  publication_id: string;
  /** Max results, 1–100 (default 20). */
  limit?: number;
  cursor?: string;
}

/**
 * Input for `emails.inbound.reply`. Provide at least one of `html`/`text`.
 *
 * Threading (In-Reply-To / References), the reply target (To), and the `Re: `
 * subject default are all derived by the server from the original inbound email
 * — they are never accepted from the caller. Omit `from` to send from the
 * verified email-purpose domain the mail was delivered to.
 */
export interface InboundReplyInput {
  from?: { email: string; name?: string };
  subject?: string;
  html?: string;
  text?: string;
  cc?: string[];
  bcc?: string[];
  idempotency_key?: string;
}

/** Response from `emails.inbound.reply`: the resulting transactional email (`txemail_…`). */
export interface InboundReplyResponse {
  /** Transactional email id (`txemail_…`). */
  id: string;
  status: string;
}

/**
 * Attachments on a received email. Access via `mailtea.emails.inbound.attachments`.
 * Each returned object carries a short-lived signed `download_url`.
 */
export class InboundAttachments {
  constructor(private readonly request: RequestFn) {}

  /** List an inbound email's attachments, each with a signed download URL. */
  list(id: string): Promise<ListResponse<InboundAttachment>> {
    return this.request<ListResponse<InboundAttachment>>(
      "GET",
      `/v1/emails/inbound/${encodeURIComponent(id)}/attachments`
    );
  }

  /** Retrieve a single inbound attachment with a signed download URL. */
  get(id: string, attachmentId: string): Promise<InboundAttachment> {
    return this.request<InboundAttachment>(
      "GET",
      `/v1/emails/inbound/${encodeURIComponent(id)}/attachments/${encodeURIComponent(attachmentId)}`
    );
  }
}

/**
 * Inbound (received) emails. Access via `mailtea.emails.inbound`. List and
 * retrieve mail delivered to your receiving domains, download attachments, and
 * `reply()` — which threads correctly by construction and reuses the
 * transactional send pipeline.
 */
export class InboundEmails {
  /** Attachments on a received email. */
  readonly attachments: InboundAttachments;

  constructor(private readonly request: RequestFn) {
    this.attachments = new InboundAttachments(request);
  }

  /** List received emails in a publication (most recent first), cursor-paginated. */
  list(params: ListInboundEmailsParams): Promise<ListResponse<InboundEmailListItem>> {
    return this.request<ListResponse<InboundEmailListItem>>(
      "GET",
      `/v1/emails/inbound${query({ ...params })}`
    );
  }

  /** Retrieve a single received email, including its body, headers, and attachments. */
  get(id: string): Promise<RetrievedInboundEmail> {
    return this.request<RetrievedInboundEmail>(
      "GET",
      `/v1/emails/inbound/${encodeURIComponent(id)}`
    );
  }

  /**
   * Reply to a received email. The reply target, threading headers, and the
   * `Re: ` subject default are all server-derived — pass only the content.
   *
   * @returns the resulting transactional email's `id` and `status` (HTTP 202).
   */
  reply(id: string, input: InboundReplyInput): Promise<InboundReplyResponse> {
    return this.request<InboundReplyResponse>(
      "POST",
      `/v1/emails/inbound/${encodeURIComponent(id)}/reply`,
      input
    );
  }
}
