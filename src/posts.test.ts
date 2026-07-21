import test from "node:test";
import assert from "node:assert/strict";
import { Mailtea } from "./index.js";
import { createMockFetch, requireCall } from "./test-utils.js";

test("posts.sendTest POSTs /v1/posts/:id/test with recipients + from", async () => {
  const mock = createMockFetch({
    json: {
      object: "test_send",
      id: "iss_1",
      sent_at: "2026-06-23T00:00:00.000Z",
      from: "Acme <a@acme.com>",
      sent_to: ["me@example.com"],
      failed_to: []
    }
  });
  const mailtea = new Mailtea("mt_pat_test", { fetch: mock.fetch });

  const result = await mailtea.posts.sendTest("iss_1", {
    recipients: ["me@example.com"],
    from: "Acme <a@acme.com>"
  });

  assert.equal(result.object, "test_send");
  assert.deepEqual(result.sent_to, ["me@example.com"]);
  const call = requireCall(mock.calls, 0);
  assert.equal(call.method, "POST");
  assert.equal(call.url, "https://api.mailtea.app/v1/posts/iss_1/test");
  assert.deepEqual(JSON.parse(call.body ?? "null"), {
    recipients: ["me@example.com"],
    from: "Acme <a@acme.com>"
  });
});

test("posts.create POSTs /v1/posts with template_id + variables", async () => {
  const mock = createMockFetch({ json: { id: "iss_new" } });
  const mailtea = new Mailtea("mt_pat_test", { fetch: mock.fetch });

  const result = await mailtea.posts.create({
    publication_id: "pub_1",
    subject: "Launch",
    template_id: "etpl_1",
    variables: { headline: "Hi", count: 3 },
    kind: "broadcast"
  });

  assert.equal(result.id, "iss_new");
  const call = requireCall(mock.calls, 0);
  assert.equal(call.method, "POST");
  assert.equal(call.url, "https://api.mailtea.app/v1/posts");
  assert.deepEqual(JSON.parse(call.body ?? "null"), {
    publication_id: "pub_1",
    subject: "Launch",
    template_id: "etpl_1",
    variables: { headline: "Hi", count: 3 },
    kind: "broadcast"
  });
});

test("posts.create passes inline html when no template", async () => {
  const mock = createMockFetch({ json: { id: "iss_2" } });
  const mailtea = new Mailtea("mt_pat_test", { fetch: mock.fetch });
  await mailtea.posts.create({ publication_id: "pub_1", subject: "S", html: "<p>x</p>" });
  assert.deepEqual(JSON.parse(requireCall(mock.calls, 0).body ?? "null"), {
    publication_id: "pub_1",
    subject: "S",
    html: "<p>x</p>"
  });
});

test("posts.send POSTs /v1/posts/:id/send with no body when immediate", async () => {
  const mock = createMockFetch({ json: { object: "post", id: "iss_1" } });
  const mailtea = new Mailtea("mt_pat_test", { fetch: mock.fetch });

  const result = await mailtea.posts.send("iss_1");

  assert.equal(result.id, "iss_1");
  const call = requireCall(mock.calls, 0);
  assert.equal(call.method, "POST");
  assert.equal(call.url, "https://api.mailtea.app/v1/posts/iss_1/send");
  assert.equal(call.body, null);
});

test("posts.send passes scheduled_at to schedule the send", async () => {
  const mock = createMockFetch({ json: { object: "post", id: "iss_1" } });
  const mailtea = new Mailtea("mt_pat_test", { fetch: mock.fetch });

  await mailtea.posts.send("iss_1", { scheduled_at: "2026-06-01T15:00:00Z" });

  assert.deepEqual(JSON.parse(requireCall(mock.calls, 0).body ?? "null"), {
    scheduled_at: "2026-06-01T15:00:00Z"
  });
});

test("posts.sendTest URL-encodes the post id", async () => {
  const mock = createMockFetch({ json: { object: "test_send", id: "x", sent_to: [], failed_to: [] } });
  const mailtea = new Mailtea("mt_pat_test", { fetch: mock.fetch });
  await mailtea.posts.sendTest("a/b", { recipients: ["m@x.com"], from: "a@b.com" });
  assert.equal(requireCall(mock.calls, 0).url, "https://api.mailtea.app/v1/posts/a%2Fb/test");
});

test("posts.create passes the extra text/from/reply_to/name fields", async () => {
  const mock = createMockFetch({ json: { id: "iss_3" } });
  const mailtea = new Mailtea("mt_pat_test", { fetch: mock.fetch });
  await mailtea.posts.create({
    publication_id: "pub_1",
    subject: "S",
    html: "<p>x</p>",
    text: "x",
    from: "Acme <a@acme.com>",
    reply_to: "reply@acme.com",
    name: "Working title"
  });
  assert.deepEqual(JSON.parse(requireCall(mock.calls, 0).body ?? "null"), {
    publication_id: "pub_1",
    subject: "S",
    html: "<p>x</p>",
    text: "x",
    from: "Acme <a@acme.com>",
    reply_to: "reply@acme.com",
    name: "Working title"
  });
});

test("posts.list GETs /v1/posts with publication_id + offset filters", async () => {
  const mock = createMockFetch({ json: { data: [], total: 0 } });
  const mailtea = new Mailtea("mt_pat_test", { fetch: mock.fetch });
  const result = await mailtea.posts.list({
    publication_id: "pub_1",
    limit: 5,
    offset: 10,
    status: "sent",
    kind: "broadcast"
  });
  assert.equal(result.total, 0);
  const call = requireCall(mock.calls, 0);
  assert.equal(call.method, "GET");
  assert.match(call.url, /\/v1\/posts\?/);
  assert.match(call.url, /publication_id=pub_1/);
  assert.match(call.url, /limit=5/);
  assert.match(call.url, /offset=10/);
  assert.match(call.url, /status=sent/);
  assert.match(call.url, /kind=broadcast/);
});

test("posts.get GETs /v1/posts/:id", async () => {
  const mock = createMockFetch({ json: { object: "post", id: "iss_1", status: "draft" } });
  const mailtea = new Mailtea("mt_pat_test", { fetch: mock.fetch });
  const post = await mailtea.posts.get("iss_1");
  assert.equal(post.id, "iss_1");
  const call = requireCall(mock.calls, 0);
  assert.equal(call.method, "GET");
  assert.equal(call.url, "https://api.mailtea.app/v1/posts/iss_1");
});

test("posts.update PATCHes /v1/posts/:id with the body", async () => {
  const mock = createMockFetch({ json: { object: "post", id: "iss_1" } });
  const mailtea = new Mailtea("mt_pat_test", { fetch: mock.fetch });
  const result = await mailtea.posts.update("iss_1", { subject: "New", html: "<p>y</p>" });
  assert.equal(result.id, "iss_1");
  const call = requireCall(mock.calls, 0);
  assert.equal(call.method, "PATCH");
  assert.equal(call.url, "https://api.mailtea.app/v1/posts/iss_1");
  assert.deepEqual(JSON.parse(call.body ?? "null"), { subject: "New", html: "<p>y</p>" });
});

test("posts.delete DELETEs /v1/posts/:id", async () => {
  const mock = createMockFetch({ json: { object: "post", id: "iss_1", deleted: true } });
  const mailtea = new Mailtea("mt_pat_test", { fetch: mock.fetch });
  const result = await mailtea.posts.delete("iss_1");
  assert.equal(result.deleted, true);
  const call = requireCall(mock.calls, 0);
  assert.equal(call.method, "DELETE");
  assert.equal(call.url, "https://api.mailtea.app/v1/posts/iss_1");
});
