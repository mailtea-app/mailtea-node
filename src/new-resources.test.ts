import test from "node:test";
import assert from "node:assert/strict";
import { Mailtea } from "./index.js";
import { createMockFetch, requireCall } from "./test-utils.js";

function client(spec: Parameters<typeof createMockFetch>[0]) {
  const mock = createMockFetch(spec);
  return { mailtea: new Mailtea("mt_pat_test", { fetch: mock.fetch }), mock };
}

const PUB = "pub_123";

// --- domains --------------------------------------------------------------

test("domains.create POSTs /v1/domains with publication and purpose", async () => {
  const { mailtea, mock } = client({
    json: { object: "domain", id: "dom_1", name: "mail.acme.com", status: "pending", records: [] }
  });
  const d = await mailtea.domains.create({ publication_id: PUB, name: "mail.acme.com", purpose: "email" });
  assert.equal(d.id, "dom_1");
  const call = requireCall(mock.calls, 0);
  assert.equal(call.method, "POST");
  assert.equal(call.url, "https://api.mailtea.app/v1/domains");
  assert.deepEqual(JSON.parse(call.body ?? "null"), {
    publication_id: PUB,
    name: "mail.acme.com",
    purpose: "email"
  });
});

test("domains.verify POSTs /v1/domains/:id/verify with publication_id and no body", async () => {
  const { mailtea, mock } = client({ json: { object: "domain", id: "dom_1", status: "verified" } });
  const d = await mailtea.domains.verify("dom_1", { publication_id: PUB });
  assert.equal(d.status, "verified");
  const call = requireCall(mock.calls, 0);
  assert.equal(call.method, "POST");
  assert.equal(call.url, "https://api.mailtea.app/v1/domains/dom_1/verify?publication_id=pub_123");
  assert.equal(call.body, null);
});

test("domains.list and delete build the right URLs", async () => {
  const { mailtea, mock } = client({ json: { object: "list", data: [], has_more: false } });
  await mailtea.domains.list({ publication_id: PUB, limit: 5 });
  const list = requireCall(mock.calls, 0);
  assert.match(list.url, /\/v1\/domains\?/);
  assert.match(list.url, /publication_id=pub_123/);
  assert.match(list.url, /limit=5/);

  const { mailtea: m2, mock: mk2 } = client({ json: { object: "domain", id: "dom_1", deleted: true } });
  await m2.domains.delete("dom_1", { publication_id: PUB });
  const del = requireCall(mk2.calls, 0);
  assert.equal(del.method, "DELETE");
  assert.equal(del.url, "https://api.mailtea.app/v1/domains/dom_1?publication_id=pub_123");
});

test("domains.tracking.create POSTs the tracking-domains sub-resource", async () => {
  const { mailtea, mock } = client({
    json: { object: "tracking_domain", id: "trk_1", full_name: "links.mail.acme.com", status: "pending" }
  });
  await mailtea.domains.tracking.create("dom_1", { publication_id: PUB, subdomain: "links" });
  const call = requireCall(mock.calls, 0);
  assert.equal(call.method, "POST");
  assert.equal(call.url, "https://api.mailtea.app/v1/domains/dom_1/tracking-domains?publication_id=pub_123");
  // publication_id goes in the query; only subdomain is in the body
  assert.deepEqual(JSON.parse(call.body ?? "null"), { subdomain: "links" });
});

test("domains.tracking.verify and delete target the nested paths", async () => {
  const { mailtea, mock } = client({ json: { object: "tracking_domain", id: "trk_1", status: "verified" } });
  await mailtea.domains.tracking.verify("dom_1", "trk_1", { publication_id: PUB });
  const v = requireCall(mock.calls, 0);
  assert.equal(v.method, "POST");
  assert.equal(v.url, "https://api.mailtea.app/v1/domains/dom_1/tracking-domains/trk_1/verify?publication_id=pub_123");
  assert.equal(v.body, null);

  const { mailtea: m2, mock: mk2 } = client({ json: { object: "tracking_domain", id: "trk_1", deleted: true } });
  await m2.domains.tracking.delete("dom_1", "trk_1", { publication_id: PUB });
  const d = requireCall(mk2.calls, 0);
  assert.equal(d.method, "DELETE");
  assert.equal(d.url, "https://api.mailtea.app/v1/domains/dom_1/tracking-domains/trk_1?publication_id=pub_123");
});

// --- webhooks -------------------------------------------------------------

test("webhooks.create POSTs /v1/webhooks/endpoints (not /v1/webhooks)", async () => {
  const { mailtea, mock } = client({
    json: { object: "webhook", id: "whk_1", endpoint: "https://x.test/h", signing_secret: "whsec_x" }
  });
  const w = await mailtea.webhooks.create({
    publication_id: PUB,
    endpoint: "https://x.test/h",
    events: ["email.delivered", "email.bounced"]
  });
  assert.equal(w.signing_secret, "whsec_x");
  const call = requireCall(mock.calls, 0);
  assert.equal(call.url, "https://api.mailtea.app/v1/webhooks/endpoints");
  assert.deepEqual(JSON.parse(call.body ?? "null"), {
    publication_id: PUB,
    endpoint: "https://x.test/h",
    events: ["email.delivered", "email.bounced"]
  });
});

test("webhooks.get/update/delete target /v1/webhooks/endpoints/:id", async () => {
  const { mailtea, mock } = client({ json: { object: "webhook", id: "whk_1", status: "disabled" } });
  await mailtea.webhooks.update("whk_1", { publication_id: PUB, status: "disabled" });
  const upd = requireCall(mock.calls, 0);
  assert.equal(upd.method, "PATCH");
  assert.equal(upd.url, "https://api.mailtea.app/v1/webhooks/endpoints/whk_1?publication_id=pub_123");
  assert.deepEqual(JSON.parse(upd.body ?? "null"), { publication_id: PUB, status: "disabled" });
});

// --- contact properties (team-scoped, no publication_id) ------------------

test("contactProperties.create POSTs /v1/contact-properties without publication_id", async () => {
  const { mailtea, mock } = client({ json: { object: "contact_property", id: "cprop_1", key: "plan" } });
  await mailtea.contactProperties.create({ key: "plan", type: "string", fallback_value: "free" });
  const call = requireCall(mock.calls, 0);
  assert.equal(call.url, "https://api.mailtea.app/v1/contact-properties");
  assert.deepEqual(JSON.parse(call.body ?? "null"), { key: "plan", type: "string", fallback_value: "free" });
});

test("contactProperties.list and delete build the right URLs", async () => {
  const { mailtea, mock } = client({ json: { object: "list", data: [], has_more: false } });
  await mailtea.contactProperties.list();
  assert.equal(requireCall(mock.calls, 0).url, "https://api.mailtea.app/v1/contact-properties");

  const { mailtea: m2, mock: mk2 } = client({ json: { object: "contact_property", id: "cprop_1", deleted: true } });
  await m2.contactProperties.delete("cprop_1");
  const del = requireCall(mk2.calls, 0);
  assert.equal(del.method, "DELETE");
  assert.equal(del.url, "https://api.mailtea.app/v1/contact-properties/cprop_1");
});

// --- api keys -------------------------------------------------------------

test("apiKeys.create POSTs /v1/api-keys and returns the one-time token", async () => {
  const { mailtea, mock } = client({ json: { id: "tok_1", token: "mt_pat_secret" } });
  const key = await mailtea.apiKeys.create({ name: "CI", permission: "sending_access" });
  assert.equal(key.token, "mt_pat_secret");
  const call = requireCall(mock.calls, 0);
  assert.equal(call.url, "https://api.mailtea.app/v1/api-keys");
  assert.deepEqual(JSON.parse(call.body ?? "null"), { name: "CI", permission: "sending_access" });
});

test("apiKeys.revoke DELETEs /v1/api-keys/:id and tolerates an empty 200 body", async () => {
  // The endpoint replies 200 with no body; the SDK must not throw on JSON parse.
  const { mailtea, mock } = client({});
  const result = await mailtea.apiKeys.revoke("tok_1");
  assert.equal(result, undefined);
  const call = requireCall(mock.calls, 0);
  assert.equal(call.method, "DELETE");
  assert.equal(call.url, "https://api.mailtea.app/v1/api-keys/tok_1");
});
