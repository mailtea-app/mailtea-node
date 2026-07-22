import test from "node:test";
import assert from "node:assert/strict";
import { Mailtea, MailteaError } from "./index.js";
import { createMockFetch, requireCall } from "./test-utils.js";

function client(spec: Parameters<typeof createMockFetch>[0]) {
  const mock = createMockFetch(spec);
  return { mailtea: new Mailtea("mt_pat_test", { fetch: mock.fetch }), mock };
}

test("send POSTs /v1/emails and returns the id", async () => {
  const { mailtea, mock } = client({ json: { id: "email_123" } });
  const result = await mailtea.emails.send({
    from: "you@example.com",
    to: "r@example.com",
    subject: "Hello",
    html: "<p>hi</p>"
  });

  assert.deepEqual(result, { id: "email_123" });
  const call = requireCall(mock.calls, 0);
  assert.equal(call.method, "POST");
  assert.equal(call.url, "https://api.mailtea.app/v1/emails");
  assert.deepEqual(JSON.parse(call.body ?? "null"), {
    from: "you@example.com",
    to: "r@example.com",
    subject: "Hello",
    html: "<p>hi</p>"
  });
});

test("send supports an array of recipients, cc/bcc, tags and scheduled_at", async () => {
  const { mailtea, mock } = client({ json: { id: "email_1" } });
  await mailtea.emails.send({
    from: "you@example.com",
    to: ["a@example.com", "b@example.com"],
    cc: "c@example.com",
    subject: "Hello",
    html: "<p>hi</p>",
    tags: [{ name: "campaign", value: "welcome" }],
    scheduled_at: "2030-01-01T00:00:00.000Z"
  });
  const body = JSON.parse(requireCall(mock.calls, 0).body ?? "null");
  assert.deepEqual(body.to, ["a@example.com", "b@example.com"]);
  assert.equal(body.cc, "c@example.com");
  assert.equal(body.scheduled_at, "2030-01-01T00:00:00.000Z");
});

test("batch POSTs /v1/emails/batch and returns data", async () => {
  const { mailtea, mock } = client({
    json: { data: [{ id: "e1" }, { id: "e2" }] }
  });
  const result = await mailtea.emails.batch([
    { from: "you@example.com", to: "a@example.com", subject: "A", html: "<p>a</p>" },
    { from: "you@example.com", to: "b@example.com", subject: "B", html: "<p>b</p>" }
  ]);

  assert.deepEqual(result, { data: [{ id: "e1" }, { id: "e2" }] });
  const call = requireCall(mock.calls, 0);
  assert.equal(call.method, "POST");
  assert.equal(call.url, "https://api.mailtea.app/v1/emails/batch");
});

test("list GETs /v1/emails with filters and returns the envelope", async () => {
  const { mailtea, mock } = client({
    json: {
      object: "list",
      data: [
        { object: "email", id: "e1", subject: "Hi", last_event: "sent", open_count: 0, click_count: 0 }
      ],
      total: 1,
      limit: 10,
      offset: 0,
      has_more: false
    }
  });
  const result = await mailtea.emails.list({ status: "sent", limit: 10, search: "invoice" });

  assert.equal(result.total, 1);
  assert.equal(result.data[0]?.id, "e1");
  const call = requireCall(mock.calls, 0);
  assert.equal(call.method, "GET");
  assert.equal(call.url, "https://api.mailtea.app/v1/emails?status=sent&limit=10&search=invoice");
  assert.equal(call.body, null);
});

test("list with no params hits the bare endpoint", async () => {
  const { mailtea, mock } = client({
    json: { object: "list", data: [], total: 0, limit: 50, offset: 0, has_more: false }
  });
  await mailtea.emails.list();
  assert.equal(requireCall(mock.calls, 0).url, "https://api.mailtea.app/v1/emails");
});

test("analytics GETs /v1/emails/analytics with the date window", async () => {
  const { mailtea, mock } = client({
    json: {
      object: "analytics",
      total: 10,
      sent: 10,
      delivered: 9,
      bounced: 1,
      opened: 4,
      clicked: 2,
      total_opens: 5,
      total_clicks: 3,
      status_counts: { delivered: 9, bounced: 1 },
      rates: { delivery_rate: 0.9, bounce_rate: 0.1, open_rate: 0.4, click_rate: 0.2 }
    }
  });
  const result = await mailtea.emails.analytics({ from_date: "2026-06-01" });

  assert.equal(result.total, 10);
  assert.equal(result.rates.delivery_rate, 0.9);
  const call = requireCall(mock.calls, 0);
  assert.equal(call.method, "GET");
  assert.equal(call.url, "https://api.mailtea.app/v1/emails/analytics?from_date=2026-06-01");
  assert.equal(call.body, null);
});

test("get retrieves an email and aliases last_event to status", async () => {
  const { mailtea, mock } = client({
    json: {
      object: "email",
      id: "email_42",
      from: "you@example.com",
      to: "r@example.com",
      subject: "Hi",
      last_event: "delivered",
      open_count: 1,
      click_count: 0,
      attachments: []
    }
  });
  const email = await mailtea.emails.get("email_42");

  assert.equal(email.id, "email_42");
  assert.equal(email.last_event, "delivered");
  assert.equal(email.status, "delivered");
  const call = requireCall(mock.calls, 0);
  assert.equal(call.method, "GET");
  assert.equal(call.url, "https://api.mailtea.app/v1/emails/email_42");
  assert.equal(call.body, null);
});

test("get URL-encodes the id", async () => {
  const { mailtea, mock } = client({ json: { object: "email", id: "x", attachments: [] } });
  await mailtea.emails.get("a/b c");
  assert.equal(
    requireCall(mock.calls, 0).url,
    "https://api.mailtea.app/v1/emails/a%2Fb%20c"
  );
});

test("update PATCHes /v1/emails/:id with scheduled_at", async () => {
  const { mailtea, mock } = client({ json: { object: "email", id: "email_9" } });
  const result = await mailtea.emails.update("email_9", {
    scheduled_at: "2030-06-01T12:00:00.000Z"
  });

  assert.deepEqual(result, { object: "email", id: "email_9" });
  const call = requireCall(mock.calls, 0);
  assert.equal(call.method, "PATCH");
  assert.equal(call.url, "https://api.mailtea.app/v1/emails/email_9");
  assert.deepEqual(JSON.parse(call.body ?? "null"), {
    scheduled_at: "2030-06-01T12:00:00.000Z"
  });
});

test("reschedule is sugar over update", async () => {
  const { mailtea, mock } = client({ json: { object: "email", id: "email_9" } });
  await mailtea.emails.reschedule("email_9", "2030-06-01T12:00:00.000Z");
  const call = requireCall(mock.calls, 0);
  assert.equal(call.method, "PATCH");
  assert.deepEqual(JSON.parse(call.body ?? "null"), {
    scheduled_at: "2030-06-01T12:00:00.000Z"
  });
});

test("cancel POSTs /v1/emails/:id/cancel", async () => {
  const { mailtea, mock } = client({ json: { object: "email", id: "email_9" } });
  const result = await mailtea.emails.cancel("email_9");

  assert.deepEqual(result, { object: "email", id: "email_9" });
  const call = requireCall(mock.calls, 0);
  assert.equal(call.method, "POST");
  assert.equal(call.url, "https://api.mailtea.app/v1/emails/email_9/cancel");
});

// --- error mapping -------------------------------------------------------

test("401 maps to MailteaError with status and message", async () => {
  const { mailtea } = client({ status: 401, json: { error: "Unauthorized" } });
  await assert.rejects(
    () => mailtea.emails.get("email_1"),
    (err: unknown) => {
      assert.ok(err instanceof MailteaError);
      assert.equal(err.status, 401);
      assert.equal(err.message, "Unauthorized");
      return true;
    }
  );
});

test("400 carries the validation details array", async () => {
  const issues = [{ path: ["subject"], message: "Required" }];
  const { mailtea } = client({
    status: 400,
    json: { error: "Validation failed", details: issues }
  });
  await assert.rejects(
    () =>
      mailtea.emails.send({
        from: "you@example.com",
        to: "r@example.com",
        subject: "x",
        html: "<p>x</p>"
      }),
    (err: unknown) => {
      assert.ok(err instanceof MailteaError);
      assert.equal(err.status, 400);
      assert.deepEqual(err.details, issues);
      return true;
    }
  );
});

test("404 and 422 and 500 map to MailteaError with the right status", async () => {
  for (const status of [404, 422, 500]) {
    const { mailtea } = client({ status, json: { error: `boom ${status}` } });
    await assert.rejects(
      () => mailtea.emails.cancel("email_1"),
      (err: unknown) => {
        assert.ok(err instanceof MailteaError);
        assert.equal(err.status, status);
        return true;
      }
    );
  }
});

test("non-JSON error body falls back to the status line", async () => {
  const { mailtea } = client({ status: 502, rawBody: "<html>Bad Gateway</html>" });
  await assert.rejects(
    () => mailtea.emails.get("email_1"),
    (err: unknown) => {
      assert.ok(err instanceof MailteaError);
      assert.equal(err.status, 502);
      assert.match(err.message, /502/);
      return true;
    }
  );
});

test("captures x-request-id from the response headers", async () => {
  const { mailtea } = client({
    status: 500,
    json: { error: "oops" },
    headers: { "x-request-id": "req_abc" }
  });
  await assert.rejects(
    () => mailtea.emails.get("email_1"),
    (err: unknown) => {
      assert.ok(err instanceof MailteaError);
      assert.equal(err.requestId, "req_abc");
      return true;
    }
  );
});
