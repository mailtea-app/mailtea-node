import test from "node:test";
import assert from "node:assert/strict";
import { Mailtea } from "./index.js";
import { createMockFetch, requireCall } from "./test-utils.js";

function client(spec: Parameters<typeof createMockFetch>[0]) {
  const mock = createMockFetch(spec);
  return { mailtea: new Mailtea("mt_pat_test", { fetch: mock.fetch }), mock };
}

const PUB = "pub_123";
const RX = "rxemail_1";

// --- inbound emails (nested under emails) ---------------------------------

test("emails.inbound.list GETs /v1/emails/inbound with publication_id, limit, cursor", async () => {
  const { mailtea, mock } = client({ json: { object: "list", data: [], has_more: false } });
  const res = await mailtea.emails.inbound.list({ publication_id: PUB, limit: 10, cursor: "abc" });
  assert.deepEqual(res, { object: "list", data: [], has_more: false });
  const call = requireCall(mock.calls, 0);
  assert.equal(call.method, "GET");
  assert.match(call.url, /\/v1\/emails\/inbound\?/);
  assert.match(call.url, /publication_id=pub_123/);
  assert.match(call.url, /limit=10/);
  assert.match(call.url, /cursor=abc/);
  assert.equal(call.body, null);
});

test("emails.inbound.get GETs /v1/emails/inbound/:id and returns the parsed JSON", async () => {
  const { mailtea, mock } = client({
    json: { object: "email", id: RX, subject: "Hi", attachments: [] }
  });
  const email = await mailtea.emails.inbound.get(RX);
  assert.equal(email.id, RX);
  assert.equal(email.subject, "Hi");
  const call = requireCall(mock.calls, 0);
  assert.equal(call.method, "GET");
  assert.equal(call.url, "https://api.mailtea.app/v1/emails/inbound/rxemail_1");
  assert.equal(call.body, null);
});

test("emails.inbound.reply POSTs /v1/emails/inbound/:id/reply with the body echoed and returns {id,status}", async () => {
  const { mailtea, mock } = client({ status: 202, json: { id: "txemail_9", status: "queued" } });
  const input = {
    from: { email: "support@newsletter.acme.com", name: "Acme Support" },
    text: "Thanks for reaching out — here is your answer.",
    cc: ["cc@acme.com"]
  };
  const res = await mailtea.emails.inbound.reply(RX, input);
  assert.deepEqual(res, { id: "txemail_9", status: "queued" });
  const call = requireCall(mock.calls, 0);
  assert.equal(call.method, "POST");
  assert.equal(call.url, "https://api.mailtea.app/v1/emails/inbound/rxemail_1/reply");
  assert.deepEqual(JSON.parse(call.body ?? "null"), input);
});

// --- inbound attachments (further-nested) ---------------------------------

test("emails.inbound.attachments.list GETs /v1/emails/inbound/:id/attachments", async () => {
  const { mailtea, mock } = client({ json: { object: "list", data: [], has_more: false } });
  await mailtea.emails.inbound.attachments.list(RX);
  const call = requireCall(mock.calls, 0);
  assert.equal(call.method, "GET");
  assert.equal(call.url, "https://api.mailtea.app/v1/emails/inbound/rxemail_1/attachments");
  assert.equal(call.body, null);
});

test("emails.inbound.attachments.get GETs the nested attachment path and returns the parsed JSON", async () => {
  const { mailtea, mock } = client({
    json: { object: "attachment", id: "rxatt_1", filename: "invoice.pdf", download_url: "https://x.test/f" }
  });
  const att = await mailtea.emails.inbound.attachments.get(RX, "rxatt_1");
  assert.equal(att.id, "rxatt_1");
  assert.equal(att.download_url, "https://x.test/f");
  const call = requireCall(mock.calls, 0);
  assert.equal(call.method, "GET");
  assert.equal(call.url, "https://api.mailtea.app/v1/emails/inbound/rxemail_1/attachments/rxatt_1");
  assert.equal(call.body, null);
});
