import test from "node:test";
import assert from "node:assert/strict";
import { Mailtea, MailteaError } from "./index.js";
import { createMockFetch, requireCall } from "./test-utils.js";

test("positional string key sets the Bearer Authorization header", async () => {
  const mock = createMockFetch({ json: { id: "email_1" } });
  const mailtea = new Mailtea("mt_pat_abc", { fetch: mock.fetch });

  await mailtea.emails.send({
    from: "you@example.com",
    to: "r@example.com",
    subject: "Hi",
    html: "<p>hi</p>"
  });

  const call = requireCall(mock.calls, 0);
  assert.equal(call.headers.get("authorization"), "Bearer mt_pat_abc");
  assert.equal(call.headers.get("content-type"), "application/json");
});

test("options-object key works", async () => {
  const mock = createMockFetch({ json: { id: "email_1" } });
  const mailtea = new Mailtea({ apiKey: "mt_svc_xyz", fetch: mock.fetch });

  await mailtea.emails.send({
    from: "you@example.com",
    to: "r@example.com",
    subject: "Hi",
    html: "<p>hi</p>"
  });

  assert.equal(
    requireCall(mock.calls, 0).headers.get("authorization"),
    "Bearer mt_svc_xyz"
  );
});

test("reads MAILTEA_API_KEY from the environment when no key is passed", async () => {
  const previous = process.env.MAILTEA_API_KEY;
  process.env.MAILTEA_API_KEY = "mt_pat_from_env";
  try {
    const mock = createMockFetch({ json: { id: "email_1" } });
    const mailtea = new Mailtea({ fetch: mock.fetch });
    await mailtea.emails.send({
      from: "you@example.com",
      to: "r@example.com",
      subject: "Hi",
      html: "<p>hi</p>"
    });
    assert.equal(
      requireCall(mock.calls, 0).headers.get("authorization"),
      "Bearer mt_pat_from_env"
    );
  } finally {
    if (previous === undefined) delete process.env.MAILTEA_API_KEY;
    else process.env.MAILTEA_API_KEY = previous;
  }
});

test("throws MailteaError when no API key is available", () => {
  const previous = process.env.MAILTEA_API_KEY;
  delete process.env.MAILTEA_API_KEY;
  try {
    assert.throws(
      () => new Mailtea({ fetch: createMockFetch({}).fetch }),
      (err: unknown) => {
        assert.ok(err instanceof MailteaError);
        assert.equal(err.code, "missing_api_key");
        assert.equal(err.status, 0);
        return true;
      }
    );
  } finally {
    if (previous !== undefined) process.env.MAILTEA_API_KEY = previous;
  }
});

test("baseUrl override is used and trailing slashes are stripped", async () => {
  const mock = createMockFetch({ json: { id: "email_1" } });
  const mailtea = new Mailtea("mt_pat_abc", {
    fetch: mock.fetch,
    baseUrl: "http://localhost:8787///"
  });

  await mailtea.emails.send({
    from: "you@example.com",
    to: "r@example.com",
    subject: "Hi",
    html: "<p>hi</p>"
  });

  assert.equal(requireCall(mock.calls, 0).url, "http://localhost:8787/v1/emails");
});

test("defaults to the production base URL", async () => {
  const mock = createMockFetch({ json: { id: "email_1" } });
  const mailtea = new Mailtea("mt_pat_abc", { fetch: mock.fetch });

  await mailtea.emails.send({
    from: "you@example.com",
    to: "r@example.com",
    subject: "Hi",
    html: "<p>hi</p>"
  });

  assert.equal(
    requireCall(mock.calls, 0).url,
    "https://api.mailtea.app/v1/emails"
  );
});

test("surfaces the API's machine-readable error code on MailteaError", async () => {
  const mock = createMockFetch({
    status: 402,
    json: {
      error: "Your plan covers transactional email only.",
      code: "marketing_plan_required"
    }
  });
  const mailtea = new Mailtea("mt_pat_abc", { fetch: mock.fetch });

  await assert.rejects(
    () => mailtea.contacts.list({ publication_id: "pub_1" }),
    (err: unknown) => {
      assert.ok(err instanceof MailteaError);
      assert.equal(err.status, 402);
      // Branching on the code has to survive a copy change to the message.
      assert.equal(err.code, "marketing_plan_required");
      assert.equal(err.message, "Your plan covers transactional email only.");
      return true;
    }
  );
});

test("leaves code undefined when the API sends no code", async () => {
  const mock = createMockFetch({ status: 404, json: { error: "Contact not found" } });
  const mailtea = new Mailtea("mt_pat_abc", { fetch: mock.fetch });

  await assert.rejects(
    () => mailtea.contacts.list({ publication_id: "pub_1" }),
    (err: unknown) => {
      assert.ok(err instanceof MailteaError);
      assert.equal(err.code, undefined);
      assert.equal(err.message, "Contact not found");
      return true;
    }
  );
});
