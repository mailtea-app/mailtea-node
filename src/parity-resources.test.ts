import test from "node:test";
import assert from "node:assert/strict";
import { Mailtea } from "./index.js";
import { createMockFetch, requireCall } from "./test-utils.js";

function client(spec: Parameters<typeof createMockFetch>[0]) {
  const mock = createMockFetch(spec);
  return { mailtea: new Mailtea("mt_pat_test", { fetch: mock.fetch }), mock };
}

const PUB = "pub_123";

// --- senders --------------------------------------------------------------

test("senders.create POSTs /v1/senders with publication_id in the body", async () => {
  const { mailtea, mock } = client({
    json: { object: "sender", id: "snd_1", email: "hi@acme.com", is_default: false }
  });
  const s = await mailtea.senders.create({
    publication_id: PUB,
    name: "Acme",
    email: "hi@acme.com",
    reply_to: "reply@acme.com"
  });
  assert.equal(s.id, "snd_1");
  const call = requireCall(mock.calls, 0);
  assert.equal(call.method, "POST");
  assert.equal(call.url, "https://api.mailtea.app/v1/senders");
  assert.deepEqual(JSON.parse(call.body ?? "null"), {
    publication_id: PUB,
    name: "Acme",
    email: "hi@acme.com",
    reply_to: "reply@acme.com"
  });
});

test("senders.list and get build the right URLs", async () => {
  const { mailtea, mock } = client({ json: { object: "list", data: [], has_more: false } });
  await mailtea.senders.list({ publication_id: PUB, limit: 5 });
  const list = requireCall(mock.calls, 0);
  assert.equal(list.method, "GET");
  assert.match(list.url, /\/v1\/senders\?/);
  assert.match(list.url, /publication_id=pub_123/);
  assert.match(list.url, /limit=5/);

  const { mailtea: m2, mock: mk2 } = client({ json: { object: "sender", id: "snd_1" } });
  await m2.senders.get("snd_1", { publication_id: PUB });
  assert.equal(
    requireCall(mk2.calls, 0).url,
    "https://api.mailtea.app/v1/senders/snd_1?publication_id=pub_123"
  );
});

test("senders.update PATCHes with publication_id in the body (email immutable)", async () => {
  const { mailtea, mock } = client({ json: { object: "sender", id: "snd_1", is_default: true } });
  await mailtea.senders.update("snd_1", { publication_id: PUB, name: "Renamed", is_default: true });
  const call = requireCall(mock.calls, 0);
  assert.equal(call.method, "PATCH");
  assert.equal(call.url, "https://api.mailtea.app/v1/senders/snd_1");
  assert.deepEqual(JSON.parse(call.body ?? "null"), {
    publication_id: PUB,
    name: "Renamed",
    is_default: true
  });
});

test("senders.delete DELETEs /v1/senders/:id with publication_id in the query", async () => {
  const { mailtea, mock } = client({ json: { object: "sender", id: "snd_1", deleted: true } });
  const res = await mailtea.senders.delete("snd_1", { publication_id: PUB });
  assert.equal(res.deleted, true);
  const call = requireCall(mock.calls, 0);
  assert.equal(call.method, "DELETE");
  assert.equal(call.url, "https://api.mailtea.app/v1/senders/snd_1?publication_id=pub_123");
});

// --- suppressions (org-scoped, no publication_id) -------------------------

test("suppressions.add POSTs /v1/suppressions and returns { added }", async () => {
  const { mailtea, mock } = client({ json: { added: 2 } });
  const res = await mailtea.suppressions.add({ emails: ["a@x.com", "b@x.com"], reason: "manual" });
  assert.equal(res.added, 2);
  const call = requireCall(mock.calls, 0);
  assert.equal(call.method, "POST");
  assert.equal(call.url, "https://api.mailtea.app/v1/suppressions");
  assert.deepEqual(JSON.parse(call.body ?? "null"), {
    emails: ["a@x.com", "b@x.com"],
    reason: "manual"
  });
});

test("suppressions.remove DELETEs /v1/suppressions with a JSON body", async () => {
  const { mailtea, mock } = client({ json: { removed: 1 } });
  const res = await mailtea.suppressions.remove({ emails: ["a@x.com"] });
  assert.equal(res.removed, 1);
  const call = requireCall(mock.calls, 0);
  assert.equal(call.method, "DELETE");
  assert.equal(call.url, "https://api.mailtea.app/v1/suppressions");
  // DELETE carries a body here — the transport must serialize it.
  assert.deepEqual(JSON.parse(call.body ?? "null"), { emails: ["a@x.com"] });
});

test("suppressions.list forwards reason/q/date/starting_after params", async () => {
  const { mailtea, mock } = client({ json: { object: "list", data: [], has_more: false } });
  await mailtea.suppressions.list({
    reason: "bounced",
    q: "acme",
    created_after: "2026-01-01",
    limit: 10,
    starting_after: "cur_1"
  });
  const url = requireCall(mock.calls, 0).url;
  assert.match(url, /\/v1\/suppressions\?/);
  assert.match(url, /reason=bounced/);
  assert.match(url, /q=acme/);
  assert.match(url, /created_after=2026-01-01/);
  assert.match(url, /limit=10/);
  assert.match(url, /starting_after=cur_1/);
});

test("suppressions.export returns the raw CSV text (not JSON-parsed)", async () => {
  const csv = "email,reason,source,created_at\na@x.com,manual,api,2026-01-01T00:00:00.000Z\n";
  const { mailtea, mock } = client({
    rawBody: csv,
    headers: { "content-type": "text/csv; charset=utf-8" }
  });
  const result = await mailtea.suppressions.export();
  assert.equal(result, csv);
  const call = requireCall(mock.calls, 0);
  assert.equal(call.method, "GET");
  assert.equal(call.url, "https://api.mailtea.app/v1/suppressions/export");
});

// --- templates ------------------------------------------------------------

test("templates.render POSTs /v1/templates/render and returns html/text", async () => {
  const { mailtea, mock } = client({ json: { html: "<p>hi</p>", text: "hi" } });
  const spec = { root: "r", elements: { r: { type: "text", props: { text: "hi" } } } };
  const rendered = await mailtea.templates.render({ spec, variables: { name: "A" } });
  assert.equal(rendered.html, "<p>hi</p>");
  const call = requireCall(mock.calls, 0);
  assert.equal(call.method, "POST");
  assert.equal(call.url, "https://api.mailtea.app/v1/templates/render");
  assert.deepEqual(JSON.parse(call.body ?? "null"), { spec, variables: { name: "A" } });
});

test("templates.create POSTs /v1/templates with publication_id in the body", async () => {
  const { mailtea, mock } = client({ json: { object: "template", id: "etpl_1", status: "draft" } });
  await mailtea.templates.create({ publication_id: PUB, name: "Welcome", html: "<p>x</p>" });
  const call = requireCall(mock.calls, 0);
  assert.equal(call.url, "https://api.mailtea.app/v1/templates");
  assert.deepEqual(JSON.parse(call.body ?? "null"), {
    publication_id: PUB,
    name: "Welcome",
    html: "<p>x</p>"
  });
});

test("templates.update PATCHes with publication_id in the query", async () => {
  const { mailtea, mock } = client({ json: { object: "template", id: "etpl_1" } });
  await mailtea.templates.update("etpl_1", { publication_id: PUB, subject: null, name: "Renamed" });
  const call = requireCall(mock.calls, 0);
  assert.equal(call.method, "PATCH");
  assert.equal(call.url, "https://api.mailtea.app/v1/templates/etpl_1?publication_id=pub_123");
  assert.deepEqual(JSON.parse(call.body ?? "null"), {
    publication_id: PUB,
    subject: null,
    name: "Renamed"
  });
});

test("templates.publish/duplicate/delete target the right paths", async () => {
  const { mailtea, mock } = client({ json: { object: "template", id: "etpl_1", status: "published" } });
  await mailtea.templates.publish("etpl_1", { publication_id: PUB });
  const pub = requireCall(mock.calls, 0);
  assert.equal(pub.method, "POST");
  assert.equal(pub.url, "https://api.mailtea.app/v1/templates/etpl_1/publish?publication_id=pub_123");
  assert.equal(pub.body, null);

  const { mailtea: m2, mock: mk2 } = client({ json: { object: "template", id: "etpl_2" } });
  await m2.templates.duplicate("etpl_1", { publication_id: PUB });
  assert.equal(
    requireCall(mk2.calls, 0).url,
    "https://api.mailtea.app/v1/templates/etpl_1/duplicate?publication_id=pub_123"
  );

  const { mailtea: m3, mock: mk3 } = client({ json: { object: "template", id: "etpl_1", deleted: true } });
  const del = await m3.templates.delete("etpl_1", { publication_id: PUB });
  assert.equal(del.deleted, true);
  const delCall = requireCall(mk3.calls, 0);
  assert.equal(delCall.method, "DELETE");
  assert.equal(delCall.url, "https://api.mailtea.app/v1/templates/etpl_1?publication_id=pub_123");
});

// --- idempotency header ---------------------------------------------------

test("emails.send sets the Idempotency-Key header when given", async () => {
  const { mailtea, mock } = client({ json: { id: "email_1" } });
  await mailtea.emails.send(
    { from: "a@b.com", to: "r@x.com", subject: "Hi", text: "hi" },
    { idempotencyKey: "key_123" }
  );
  const call = requireCall(mock.calls, 0);
  assert.equal(call.headers.get("idempotency-key"), "key_123");
});

test("emails.send omits the Idempotency-Key header by default", async () => {
  const { mailtea, mock } = client({ json: { id: "email_1" } });
  await mailtea.emails.send({ from: "a@b.com", to: "r@x.com", subject: "Hi", text: "hi" });
  assert.equal(requireCall(mock.calls, 0).headers.get("idempotency-key"), null);
});

test("emails.batch sets the Idempotency-Key header when given", async () => {
  const { mailtea, mock } = client({ json: { data: [{ id: "email_1" }] } });
  await mailtea.emails.batch(
    [{ from: "a@b.com", to: "r@x.com", subject: "Hi", text: "hi" }],
    { idempotencyKey: "batch_key" }
  );
  assert.equal(requireCall(mock.calls, 0).headers.get("idempotency-key"), "batch_key");
});
