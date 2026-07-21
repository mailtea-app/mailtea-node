export { Mailtea } from "./client.js";
export type { MailteaOptions } from "./client.js";
export { MailteaError } from "./errors.js";
export type { MailteaErrorInit } from "./errors.js";
export { Emails } from "./emails.js";
export type { SendOptions } from "./emails.js";
export { InboundEmails, InboundAttachments } from "./inbound.js";
export { Contacts } from "./contacts.js";
export { Segments } from "./segments.js";
export { Tags } from "./tags.js";
export { Posts } from "./posts.js";
export { Senders } from "./senders.js";
export { Suppressions } from "./suppressions.js";
export { Templates } from "./templates.js";
export { Domains } from "./domains.js";
export { Webhooks } from "./webhooks.js";
export { ContactProperties } from "./contact-properties.js";
export { ApiKeys } from "./api-keys.js";
export {
  verifyWebhookSignature,
  signWebhook
} from "./webhook-signing.js";
export type {
  SignWebhookInput,
  VerifyWebhookSignatureInput
} from "./webhook-signing.js";
export type { RequestFn, TextRequestFn, ListResponse, DeletedResponse } from "./resource.js";
export type * from "./types.js";
export type * from "./inbound.js";
export type * from "./contacts.js";
export type * from "./segments.js";
export type * from "./tags.js";
export type * from "./posts.js";
export type * from "./senders.js";
export type * from "./suppressions.js";
export type * from "./templates.js";
export type * from "./domains.js";
export type * from "./webhooks.js";
export type * from "./contact-properties.js";
export type * from "./api-keys.js";
