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

test("baseUrl falls back to MAILTEA_API_BASE_URL, and an explicit option still wins", async () => {
  const previous = process.env.MAILTEA_API_BASE_URL;
  process.env.MAILTEA_API_BASE_URL = "http://localhost:7787/";
  try {
    const seen: string[] = [];
    const stubFetch = (async (input: RequestInfo | URL) => {
      seen.push(String(input));
      return new Response(JSON.stringify({ id: "txemail_1" }), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    }) as unknown as typeof fetch;

    await new Mailtea("mt_pat_test", { fetch: stubFetch }).emails.send({
      from: "a@b.com",
      to: "c@d.com",
      subject: "s",
      html: "<p>h</p>"
    });
    await new Mailtea("mt_pat_test", {
      fetch: stubFetch,
      baseUrl: "https://explicit.example"
    }).emails.send({ from: "a@b.com", to: "c@d.com", subject: "s", html: "<p>h</p>" });

    assert.equal(seen[0], "http://localhost:7787/v1/emails");
    assert.equal(seen[1], "https://explicit.example/v1/emails");
  } finally {
    if (previous === undefined) delete process.env.MAILTEA_API_BASE_URL;
    else process.env.MAILTEA_API_BASE_URL = previous;
  }
});

test("the global fetch is bound, so a runtime that rejects a detached fetch still works", async () => {
  // Stands in for the Cloudflare Workers runtime, which throws "Illegal
  // invocation" when `fetch` is called with `this` detached from the global
  // scope. Without the bind in the constructor, the SDK calls its stored
  // reference bare and `this` is undefined here.
  const previousFetch = globalThis.fetch;
  (globalThis as { fetch: unknown }).fetch = function (this: unknown) {
    if (this !== globalThis) throw new TypeError("Illegal invocation");
    return Promise.resolve(
      new Response(JSON.stringify({ id: "txemail_1" }), {
        status: 200,
        headers: { "content-type": "application/json" }
      })
    );
  };

  try {
    const sent = await new Mailtea("mt_pat_test").emails.send({
      from: "a@b.com",
      to: "c@d.com",
      subject: "s",
      html: "<p>h</p>"
    });
    assert.equal(sent.id, "txemail_1");
  } finally {
    (globalThis as { fetch: unknown }).fetch = previousFetch;
  }
});
