import test from "node:test";
import assert from "node:assert/strict";
import { Mailtea } from "./index.js";
import type { AutomationValidation } from "./automations.js";
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

// --- automations ----------------------------------------------------------

const TRIGGER_STEP = { key: "start", type: "trigger" as const, config: { trigger_type: "contact.created" } };
const DELAY_STEP = { key: "wait", type: "delay" as const, config: { duration: 2, unit: "days" } };

test("automations.validate POSTs /v1/automations/validate with publication_id in the body", async () => {
  const { mailtea, mock } = client({
    json: { object: "automation_validation", valid: true, issues: [] }
  });
  const result = await mailtea.automations.validate({
    publication_id: PUB,
    steps: [TRIGGER_STEP, DELAY_STEP]
  });
  assert.equal(result.valid, true);
  const call = requireCall(mock.calls, 0);
  assert.equal(call.method, "POST");
  assert.equal(call.url, "https://api.mailtea.app/v1/automations/validate");
  assert.deepEqual(JSON.parse(call.body ?? "null"), {
    publication_id: PUB,
    steps: [TRIGGER_STEP, DELAY_STEP]
  });
});

test("automations.create POSTs /v1/automations with publication_id in the body", async () => {
  const { mailtea, mock } = client({
    json: { object: "automation", id: "aut_1", status: "draft" }
  });
  await mailtea.automations.create({
    publication_id: PUB,
    name: "Welcome",
    steps: [TRIGGER_STEP, DELAY_STEP],
    connections: [{ from: "start", to: "wait", branch: "next" }],
    reentry_policy: "once"
  });
  const call = requireCall(mock.calls, 0);
  assert.equal(call.method, "POST");
  // No query string — publication_id rides in the body on this verb.
  assert.equal(call.url, "https://api.mailtea.app/v1/automations");
  assert.deepEqual(JSON.parse(call.body ?? "null"), {
    publication_id: PUB,
    name: "Welcome",
    steps: [TRIGGER_STEP, DELAY_STEP],
    connections: [{ from: "start", to: "wait", branch: "next" }],
    reentry_policy: "once"
  });
});

test("automations.create with validate_only narrows to the validation shape", async () => {
  const { mailtea, mock } = client({
    json: { object: "automation_validation", valid: false, issues: [{ code: "missing_trigger", severity: "error", message: "no trigger" }] }
  });
  // Typed as AutomationValidation, not Automation — the overload does the narrowing.
  const validation: AutomationValidation = await mailtea.automations.create({
    publication_id: PUB,
    name: "Welcome",
    steps: [DELAY_STEP],
    validate_only: true
  });
  assert.equal(validation.valid, false);
  assert.equal(validation.issues[0]?.code, "missing_trigger");
  const call = requireCall(mock.calls, 0);
  assert.deepEqual(JSON.parse(call.body ?? "null"), {
    publication_id: PUB,
    name: "Welcome",
    steps: [DELAY_STEP],
    validate_only: true
  });
});

test("automations.list and get build the right URLs", async () => {
  const { mailtea, mock } = client({ json: { object: "list", data: [], has_more: false } });
  await mailtea.automations.list({ publication_id: PUB, status: "active", limit: 5, after: "cur_1" });
  const list = requireCall(mock.calls, 0);
  assert.equal(list.method, "GET");
  assert.equal(
    list.url,
    "https://api.mailtea.app/v1/automations?publication_id=pub_123&status=active&limit=5&after=cur_1"
  );

  const { mailtea: m2, mock: mk2 } = client({ json: { object: "automation", id: "aut_1" } });
  await m2.automations.get("aut_1", { publication_id: PUB });
  assert.equal(
    requireCall(mk2.calls, 0).url,
    "https://api.mailtea.app/v1/automations/aut_1?publication_id=pub_123"
  );
});

test("automations.update PATCHes with publication_id in the query, never in the body", async () => {
  const { mailtea, mock } = client({ json: { object: "automation", id: "aut_1" } });
  await mailtea.automations.update("aut_1", {
    publication_id: PUB,
    name: "Renamed",
    steps: [TRIGGER_STEP],
    connections: []
  });
  const call = requireCall(mock.calls, 0);
  assert.equal(call.method, "PATCH");
  assert.equal(call.url, "https://api.mailtea.app/v1/automations/aut_1?publication_id=pub_123");
  // The server's update schema has no publication_id — it must be stripped.
  assert.deepEqual(JSON.parse(call.body ?? "null"), {
    name: "Renamed",
    steps: [TRIGGER_STEP],
    connections: []
  });
});

test("automations.update with validate_only narrows to the validation shape", async () => {
  const { mailtea, mock } = client({
    json: { object: "automation_validation", valid: true, issues: [] }
  });
  const validation: AutomationValidation = await mailtea.automations.update("aut_1", {
    publication_id: PUB,
    steps: [TRIGGER_STEP],
    validate_only: true
  });
  assert.equal(validation.object, "automation_validation");
  const call = requireCall(mock.calls, 0);
  assert.deepEqual(JSON.parse(call.body ?? "null"), {
    steps: [TRIGGER_STEP],
    validate_only: true
  });
});

test("automations.delete DELETEs /v1/automations/:id with publication_id in the query", async () => {
  const { mailtea, mock } = client({ json: { object: "automation", id: "aut_1", deleted: true } });
  const res = await mailtea.automations.delete("aut_1", { publication_id: PUB });
  assert.equal(res.deleted, true);
  const call = requireCall(mock.calls, 0);
  assert.equal(call.method, "DELETE");
  assert.equal(call.url, "https://api.mailtea.app/v1/automations/aut_1?publication_id=pub_123");
});

test("automations.activate POSTs /:id/activate with no body", async () => {
  const { mailtea, mock } = client({ json: { object: "automation", id: "aut_1", status: "active" } });
  await mailtea.automations.activate("aut_1", { publication_id: PUB });
  const call = requireCall(mock.calls, 0);
  assert.equal(call.method, "POST");
  assert.equal(
    call.url,
    "https://api.mailtea.app/v1/automations/aut_1/activate?publication_id=pub_123"
  );
  assert.equal(call.body, null);
});

test("automations.pause sends no body when cancel_runs is omitted", async () => {
  const { mailtea, mock } = client({
    json: { object: "automation", id: "aut_1", status: "paused", canceled_runs: 0 }
  });
  const res = await mailtea.automations.pause("aut_1", { publication_id: PUB });
  assert.equal(res.canceled_runs, 0);
  const call = requireCall(mock.calls, 0);
  assert.equal(call.method, "POST");
  assert.equal(call.url, "https://api.mailtea.app/v1/automations/aut_1/pause?publication_id=pub_123");
  // No body at all, so the server's default (false for pause) applies.
  assert.equal(call.body, null);
});

test("automations.pause and archive send cancel_runs when the caller supplies it", async () => {
  const { mailtea, mock } = client({
    json: { object: "automation", id: "aut_1", status: "paused", canceled_runs: 3 }
  });
  await mailtea.automations.pause("aut_1", { publication_id: PUB, cancel_runs: true });
  const pause = requireCall(mock.calls, 0);
  assert.equal(pause.url, "https://api.mailtea.app/v1/automations/aut_1/pause?publication_id=pub_123");
  assert.deepEqual(JSON.parse(pause.body ?? "null"), { cancel_runs: true });

  const { mailtea: m2, mock: mk2 } = client({
    json: { object: "automation", id: "aut_1", status: "archived", canceled_runs: 0 }
  });
  // archive defaults cancel_runs TRUE, so `false` must actually be transmitted.
  await m2.automations.archive("aut_1", { publication_id: PUB, cancel_runs: false });
  const archive = requireCall(mk2.calls, 0);
  assert.equal(archive.method, "POST");
  assert.equal(
    archive.url,
    "https://api.mailtea.app/v1/automations/aut_1/archive?publication_id=pub_123"
  );
  assert.deepEqual(JSON.parse(archive.body ?? "null"), { cancel_runs: false });
});

test("automations.archive sends no body when cancel_runs is omitted", async () => {
  const { mailtea, mock } = client({
    json: { object: "automation", id: "aut_1", status: "archived", canceled_runs: 2 }
  });
  await mailtea.automations.archive("aut_1", { publication_id: PUB });
  const call = requireCall(mock.calls, 0);
  assert.equal(
    call.url,
    "https://api.mailtea.app/v1/automations/aut_1/archive?publication_id=pub_123"
  );
  assert.equal(call.body, null);
});

test("automations.listVersions and getVersion target the right paths", async () => {
  const { mailtea, mock } = client({ json: { object: "list", data: [], has_more: false } });
  await mailtea.automations.listVersions("aut_1", { publication_id: PUB, limit: 10 });
  assert.equal(
    requireCall(mock.calls, 0).url,
    "https://api.mailtea.app/v1/automations/aut_1/versions?publication_id=pub_123&limit=10"
  );

  const { mailtea: m2, mock: mk2 } = client({
    json: { object: "automation_version", id: "autv_1", version: 3 }
  });
  await m2.automations.getVersion("aut_1", 3, { publication_id: PUB });
  const call = requireCall(mk2.calls, 0);
  assert.equal(call.method, "GET");
  assert.equal(
    call.url,
    "https://api.mailtea.app/v1/automations/aut_1/versions/3?publication_id=pub_123"
  );
});

test("automations.metrics forwards version/since/until", async () => {
  const { mailtea, mock } = client({
    json: { object: "automation_metrics", automation_id: "aut_1", steps: [] }
  });
  await mailtea.automations.metrics("aut_1", {
    publication_id: PUB,
    version: 2,
    since: "2026-01-01T00:00:00.000Z",
    until: "2026-02-01T00:00:00.000Z"
  });
  const call = requireCall(mock.calls, 0);
  assert.equal(call.method, "GET");
  assert.equal(
    call.url,
    "https://api.mailtea.app/v1/automations/aut_1/metrics?publication_id=pub_123&version=2&since=2026-01-01T00%3A00%3A00.000Z&until=2026-02-01T00%3A00%3A00.000Z"
  );
});

test("automations.test POSTs /:id/test with publication_id in the query only", async () => {
  const { mailtea, mock } = client({
    json: { object: "automation_run", id: "autr_1", is_test: true }
  });
  const run = await mailtea.automations.test("aut_1", {
    publication_id: PUB,
    email: "reader@example.com",
    event_properties: { plan: "pro" }
  });
  assert.equal(run.is_test, true);
  const call = requireCall(mock.calls, 0);
  assert.equal(call.method, "POST");
  assert.equal(call.url, "https://api.mailtea.app/v1/automations/aut_1/test?publication_id=pub_123");
  assert.deepEqual(JSON.parse(call.body ?? "null"), {
    email: "reader@example.com",
    event_properties: { plan: "pro" }
  });
});

test("automations paths escape ids that contain URL-significant characters", async () => {
  const { mailtea, mock } = client({ json: { object: "automation", id: "aut_a/b" } });
  await mailtea.automations.get("aut_a/b", { publication_id: PUB });
  assert.equal(
    requireCall(mock.calls, 0).url,
    "https://api.mailtea.app/v1/automations/aut_a%2Fb?publication_id=pub_123"
  );
});

// --- automation runs ------------------------------------------------------

test("automationRuns.list joins a status array into one comma-separated param", async () => {
  const { mailtea, mock } = client({ json: { object: "list", data: [], has_more: false } });
  await mailtea.automationRuns.list("aut_1", {
    publication_id: PUB,
    contact_id: "con_1",
    limit: 25,
    status: ["executing", "waiting_event"],
    is_test: false
  });
  const call = requireCall(mock.calls, 0);
  assert.equal(call.method, "GET");
  assert.equal(
    call.url,
    "https://api.mailtea.app/v1/automations/aut_1/runs?publication_id=pub_123&contact_id=con_1&limit=25&status=executing%2Cwaiting_event&is_test=false"
  );
});

test("automationRuns.list sends a single status unjoined", async () => {
  const { mailtea, mock } = client({ json: { object: "list", data: [], has_more: false } });
  await mailtea.automationRuns.list("aut_1", { publication_id: PUB, status: "failed" });
  assert.equal(
    requireCall(mock.calls, 0).url,
    "https://api.mailtea.app/v1/automations/aut_1/runs?publication_id=pub_123&status=failed"
  );
});

test("automationRuns.get and cancel target the right paths", async () => {
  const { mailtea, mock } = client({
    json: { object: "automation_run", id: "autr_1", status: "completed" }
  });
  await mailtea.automationRuns.get("aut_1", "autr_1", { publication_id: PUB });
  const get = requireCall(mock.calls, 0);
  assert.equal(get.method, "GET");
  assert.equal(
    get.url,
    "https://api.mailtea.app/v1/automations/aut_1/runs/autr_1?publication_id=pub_123"
  );

  const { mailtea: m2, mock: mk2 } = client({
    json: { object: "automation_run", id: "autr_1", status: "canceled" }
  });
  const canceled = await m2.automationRuns.cancel("aut_1", "autr_1", { publication_id: PUB });
  assert.equal(canceled.status, "canceled");
  const cancel = requireCall(mk2.calls, 0);
  assert.equal(cancel.method, "POST");
  assert.equal(
    cancel.url,
    "https://api.mailtea.app/v1/automations/aut_1/runs/autr_1/cancel?publication_id=pub_123"
  );
  assert.equal(cancel.body, null);
});

// --- events ---------------------------------------------------------------

test("events.send POSTs /v1/events with publication_id in the body", async () => {
  const { mailtea, mock } = client({
    json: {
      object: "event",
      id: "evt_1",
      name: "order.placed",
      contact_id: "con_1",
      enrolled_automations: 1,
      resumed_runs: 0
    }
  });
  const result = await mailtea.events.send({
    publication_id: PUB,
    name: "order.placed",
    email: "reader@example.com",
    create_contact: true,
    properties: { total: 42 },
    idempotency_key: "ord_1"
  });
  assert.equal(result.enrolled_automations, 1);
  const call = requireCall(mock.calls, 0);
  assert.equal(call.method, "POST");
  assert.equal(call.url, "https://api.mailtea.app/v1/events");
  assert.deepEqual(JSON.parse(call.body ?? "null"), {
    publication_id: PUB,
    name: "order.placed",
    email: "reader@example.com",
    create_contact: true,
    properties: { total: 42 },
    idempotency_key: "ord_1"
  });
});

test("events.list forwards name/contact_id/limit/after", async () => {
  const { mailtea, mock } = client({ json: { object: "list", data: [], has_more: false } });
  await mailtea.events.list({
    publication_id: PUB,
    name: "order.placed",
    contact_id: "con_1",
    limit: 50,
    after: "cur_1"
  });
  const call = requireCall(mock.calls, 0);
  assert.equal(call.method, "GET");
  assert.equal(
    call.url,
    "https://api.mailtea.app/v1/events?publication_id=pub_123&name=order.placed&contact_id=con_1&limit=50&after=cur_1"
  );
});

// --- event definitions ----------------------------------------------------

test("eventDefinitions.create POSTs /v1/event-definitions with publication_id in the body", async () => {
  const schema = { properties: { total: { type: "number" as const, required: true } } };
  const { mailtea, mock } = client({
    json: { object: "event_definition", id: "evd_1", name: "order.placed" }
  });
  await mailtea.eventDefinitions.create({
    publication_id: PUB,
    name: "order.placed",
    description: "A completed checkout",
    schema_json: schema
  });
  const call = requireCall(mock.calls, 0);
  assert.equal(call.method, "POST");
  assert.equal(call.url, "https://api.mailtea.app/v1/event-definitions");
  assert.deepEqual(JSON.parse(call.body ?? "null"), {
    publication_id: PUB,
    name: "order.placed",
    description: "A completed checkout",
    schema_json: schema
  });
});

test("eventDefinitions.list and get build the right URLs", async () => {
  const { mailtea, mock } = client({ json: { object: "list", data: [], has_more: false } });
  await mailtea.eventDefinitions.list({ publication_id: PUB, limit: 20 });
  assert.equal(
    requireCall(mock.calls, 0).url,
    "https://api.mailtea.app/v1/event-definitions?publication_id=pub_123&limit=20"
  );

  const { mailtea: m2, mock: mk2 } = client({
    json: { object: "event_definition", id: "evd_1", inferred_properties: [] }
  });
  await m2.eventDefinitions.get("evd_1", { publication_id: PUB });
  assert.equal(
    requireCall(mk2.calls, 0).url,
    "https://api.mailtea.app/v1/event-definitions/evd_1?publication_id=pub_123"
  );
});

test("eventDefinitions.update PATCHes with publication_id in the query, never in the body", async () => {
  const { mailtea, mock } = client({ json: { object: "event_definition", id: "evd_1" } });
  await mailtea.eventDefinitions.update("evd_1", {
    publication_id: PUB,
    description: "Renamed description",
    schema_json: null
  });
  const call = requireCall(mock.calls, 0);
  assert.equal(call.method, "PATCH");
  assert.equal(
    call.url,
    "https://api.mailtea.app/v1/event-definitions/evd_1?publication_id=pub_123"
  );
  assert.deepEqual(JSON.parse(call.body ?? "null"), {
    description: "Renamed description",
    schema_json: null
  });
});

test("eventDefinitions.delete DELETEs with publication_id in the query", async () => {
  const { mailtea, mock } = client({
    json: { object: "event_definition", id: "evd_1", deleted: true }
  });
  const res = await mailtea.eventDefinitions.delete("evd_1", { publication_id: PUB });
  assert.equal(res.deleted, true);
  const call = requireCall(mock.calls, 0);
  assert.equal(call.method, "DELETE");
  assert.equal(
    call.url,
    "https://api.mailtea.app/v1/event-definitions/evd_1?publication_id=pub_123"
  );
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
