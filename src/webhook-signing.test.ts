import test from "node:test";
import assert from "node:assert/strict";
import { signWebhook, verifyWebhookSignature } from "./webhook-signing.js";
import {
  signWebhook as contractsSignWebhook,
  verifyWebhookSignature as contractsVerifyWebhookSignature
} from "@mailtea/contracts";

// The SDK ships a self-contained copy of the contracts webhook-signing helpers
// (no runtime dependency on @mailtea/contracts). These tests guard against the
// copy drifting: the SDK signs and verifies its own output, and the SDK output
// is cross-checked against @mailtea/contracts (a devDep) in both directions.

const SECRET = "whsec_dGVzdC1zaWduaW5nLWtleS0zMi1ieXRlcy1sb25n";
const MSG_ID = "whdel_0123456789abcdef";
const TIMESTAMP = 1_700_000_000; // Unix seconds
const PAYLOAD = '{"id":"evt_abc","type":"email.sent","data":{}}';

test("round-trips: sign then verify the same payload passes", () => {
  const header = signWebhook({ secret: SECRET, msgId: MSG_ID, timestamp: TIMESTAMP, payload: PAYLOAD });
  assert.equal(
    verifyWebhookSignature({
      secret: SECRET,
      msgId: MSG_ID,
      timestamp: TIMESTAMP,
      payload: PAYLOAD,
      signatureHeader: header,
      now: TIMESTAMP + 10
    }),
    true
  );
});

test("rejects a tampered payload", () => {
  const header = signWebhook({ secret: SECRET, msgId: MSG_ID, timestamp: TIMESTAMP, payload: PAYLOAD });
  assert.equal(
    verifyWebhookSignature({
      secret: SECRET,
      msgId: MSG_ID,
      timestamp: TIMESTAMP,
      payload: PAYLOAD + "tamper",
      signatureHeader: header,
      now: TIMESTAMP
    }),
    false
  );
});

test("SDK copy matches @mailtea/contracts byte-for-byte (both directions)", () => {
  const input = { secret: SECRET, msgId: MSG_ID, timestamp: TIMESTAMP, payload: PAYLOAD };
  const sdkHeader = signWebhook(input);
  const contractsHeader = contractsSignWebhook(input);
  assert.equal(sdkHeader, contractsHeader);

  // A signature from either implementation verifies against the other.
  assert.equal(
    contractsVerifyWebhookSignature({ ...input, signatureHeader: sdkHeader, now: TIMESTAMP }),
    true
  );
  assert.equal(
    verifyWebhookSignature({ ...input, signatureHeader: contractsHeader, now: TIMESTAMP }),
    true
  );
});
