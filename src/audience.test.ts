import test from "node:test";
import assert from "node:assert/strict";
import { Mailtea } from "./index.js";
import { createMockFetch, requireCall } from "./test-utils.js";

function client(spec: Parameters<typeof createMockFetch>[0]) {
  const mock = createMockFetch(spec);
  return { mailtea: new Mailtea("mt_pat_test", { fetch: mock.fetch }), mock };
}

const PUB = "pub_123";

// --- contacts -------------------------------------------------------------

test("contacts.create POSTs /v1/contacts with the body", async () => {
  const { mailtea, mock } = client({
    json: { object: "contact", id: "ct_1", publication_id: PUB, email: "a@b.com", status: "active" }
  });
  const c = await mailtea.contacts.create({ publication_id: PUB, email: "a@b.com" });
  assert.equal(c.id, "ct_1");
  const call = requireCall(mock.calls, 0);
  assert.equal(call.method, "POST");
  assert.equal(call.url, "https://api.mailtea.app/v1/contacts");
  assert.deepEqual(JSON.parse(call.body ?? "null"), { publication_id: PUB, email: "a@b.com" });
});

test("contacts.upsert is contacts.create (POST /v1/contacts)", async () => {
  const { mailtea, mock } = client({
    json: { object: "contact", id: "ct_1", publication_id: PUB, email: "a@b.com", status: "active" }
  });
  const c = await mailtea.contacts.upsert({ publication_id: PUB, email: "a@b.com", status: "active" });
  assert.equal(c.id, "ct_1");
  const call = requireCall(mock.calls, 0);
  assert.equal(call.method, "POST");
  assert.equal(call.url, "https://api.mailtea.app/v1/contacts");
  assert.deepEqual(JSON.parse(call.body ?? "null"), {
    publication_id: PUB,
    email: "a@b.com",
    status: "active"
  });
});

test("contacts.list builds the query string and returns the list envelope", async () => {
  const { mailtea, mock } = client({
    json: { object: "list", data: [], has_more: false }
  });
  const res = await mailtea.contacts.list({ publication_id: PUB, limit: 50, status: "active" });
  assert.equal(res.object, "list");
  assert.equal(res.has_more, false);
  const url = requireCall(mock.calls, 0).url;
  assert.match(url, /\/v1\/contacts\?/);
  assert.match(url, /publication_id=pub_123/);
  assert.match(url, /limit=50/);
  assert.match(url, /status=active/);
});

test("contacts.get and delete URL-encode the id and add publication_id", async () => {
  const { mailtea, mock } = client({ json: { object: "contact", id: "x" } });
  await mailtea.contacts.get("a@b.com", { publication_id: PUB });
  assert.equal(
    requireCall(mock.calls, 0).url,
    "https://api.mailtea.app/v1/contacts/a%40b.com?publication_id=pub_123"
  );

  const { mailtea: m2, mock: mk2 } = client({ json: { object: "contact", id: "x", deleted: true } });
  await m2.contacts.delete("ct_1", { publication_id: PUB });
  const del = requireCall(mk2.calls, 0);
  assert.equal(del.method, "DELETE");
  assert.equal(del.url, "https://api.mailtea.app/v1/contacts/ct_1?publication_id=pub_123");
});

test("contacts.update PATCHes with publication_id in BOTH body and query", async () => {
  const { mailtea, mock } = client({ json: { object: "contact", id: "ct_1" } });
  await mailtea.contacts.update("ct_1", { publication_id: PUB, status: "unsubscribed" });
  const call = requireCall(mock.calls, 0);
  assert.equal(call.method, "PATCH");
  assert.match(call.url, /\/v1\/contacts\/ct_1\?publication_id=pub_123/);
  assert.deepEqual(JSON.parse(call.body ?? "null"), {
    publication_id: PUB,
    status: "unsubscribed"
  });
});

// --- segments -------------------------------------------------------------

test("segments.create and update hit /v1/segments", async () => {
  const { mailtea, mock } = client({ json: { object: "segment", id: "sg_1" } });
  await mailtea.segments.create({ publication_id: PUB, name: "Engaged" });
  assert.equal(requireCall(mock.calls, 0).url, "https://api.mailtea.app/v1/segments");

  const { mailtea: m2, mock: mk2 } = client({ json: { object: "segment", id: "sg_1" } });
  await m2.segments.update("sg_1", { publication_id: PUB, name: "Renamed" });
  const upd = requireCall(mk2.calls, 0);
  assert.equal(upd.method, "PATCH");
  assert.match(upd.url, /\/v1\/segments\/sg_1\?publication_id=pub_123/);
  assert.deepEqual(JSON.parse(upd.body ?? "null"), { publication_id: PUB, name: "Renamed" });
});

// --- tags -----------------------------------------------------------------

test("tags.create POSTs with required default_subscription", async () => {
  const { mailtea, mock } = client({ json: { object: "tag", id: "tg_1" } });
  await mailtea.tags.create({ publication_id: PUB, name: "VIP", default_subscription: "opt_in" });
  const call = requireCall(mock.calls, 0);
  assert.equal(call.url, "https://api.mailtea.app/v1/tags");
  assert.deepEqual(JSON.parse(call.body ?? "null"), {
    publication_id: PUB,
    name: "VIP",
    default_subscription: "opt_in"
  });
});

test("tags.list returns the list envelope", async () => {
  const { mailtea } = client({ json: { object: "list", data: [{ object: "tag", id: "tg_1" }], has_more: false } });
  const res = await mailtea.tags.list({ publication_id: PUB });
  assert.equal(res.data.length, 1);
  assert.equal(res.data[0]?.id, "tg_1");
});

test("audience errors map to MailteaError", async () => {
  const { mailtea } = client({ status: 403, json: { error: "Insufficient permissions" } });
  await assert.rejects(() => mailtea.contacts.list({ publication_id: PUB }), (err: unknown) => {
    assert.ok(err instanceof Error && err.name === "MailteaError");
    return true;
  });
});
