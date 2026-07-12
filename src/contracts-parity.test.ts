import test from "node:test";
import type {
  SendEmailInput,
  BatchEmailInput,
  UpdateEmailInput,
  TemplateRef
} from "./types.js";
import type { WebhookEvent } from "./webhooks.js";
import type { InboundReplyInput } from "./inbound.js";
import type {
  SendEmailInput as ContractsSendEmailInput,
  BatchEmailInput as ContractsBatchEmailInput,
  UpdateEmailInput as ContractsUpdateEmailInput,
  TemplateRef as ContractsTemplateRef,
  WebhookEventType as ContractsWebhookEventType,
  InboundReplyInput as ContractsInboundReplyInput
} from "@mailtea/contracts";

// Compile-time drift guard. The published `mailtea` SDK defines its wire types
// locally (so the package has no runtime/types dependency on @mailtea/contracts),
// but they MUST stay mutually assignable with the contracts source of truth.
// If they diverge, `pnpm --filter mailtea typecheck` fails on these lines.
// `@mailtea/contracts` is a devDependency only — it never ships with the SDK.

const _sendToContracts: ContractsSendEmailInput = null as unknown as SendEmailInput;
const _sendFromContracts: SendEmailInput = null as unknown as ContractsSendEmailInput;
const _batchToContracts: ContractsBatchEmailInput = null as unknown as BatchEmailInput;
const _batchFromContracts: BatchEmailInput = null as unknown as ContractsBatchEmailInput;
const _updateToContracts: ContractsUpdateEmailInput = null as unknown as UpdateEmailInput;
const _updateFromContracts: UpdateEmailInput = null as unknown as ContractsUpdateEmailInput;
const _templateToContracts: ContractsTemplateRef = null as unknown as TemplateRef;
const _templateFromContracts: TemplateRef = null as unknown as ContractsTemplateRef;
const _webhookEventToContracts: ContractsWebhookEventType = null as unknown as WebhookEvent;
const _webhookEventFromContracts: WebhookEvent = null as unknown as ContractsWebhookEventType;
const _inboundReplyToContracts: ContractsInboundReplyInput = null as unknown as InboundReplyInput;
const _inboundReplyFromContracts: InboundReplyInput = null as unknown as ContractsInboundReplyInput;

void _sendToContracts;
void _sendFromContracts;
void _batchToContracts;
void _batchFromContracts;
void _updateToContracts;
void _updateFromContracts;
void _templateToContracts;
void _templateFromContracts;
void _webhookEventToContracts;
void _webhookEventFromContracts;
void _inboundReplyToContracts;
void _inboundReplyFromContracts;

test("SDK wire types stay in parity with @mailtea/contracts (enforced at typecheck)", () => {});
