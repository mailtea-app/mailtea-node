import test from "node:test";
import assert from "node:assert/strict";
import { Mailtea } from "./index.js";
import { createMockFetch, requireCall } from "./test-utils.js";

// React Email renders in the caller's process, so these tests exercise the
// real renderer and assert the wire body carries plain `html` — the API never
// sees a `react` field.

function client(spec: Parameters<typeof createMockFetch>[0]) {
  const mock = createMockFetch(spec);
  return { mailtea: new Mailtea("mt_pat_test", { fetch: mock.fetch }), mock };
}

const Hello = ({ name }: { name: string }) => (
  <html>
    <body>
      <p style={{ color: "rebeccapurple" }}>Hello {name}</p>
    </body>
  </html>
);

test("send renders `react` to html locally and never sends the react field", async () => {
  const { mailtea, mock } = client({ json: { id: "email_1" } });
  const result = await mailtea.emails.send({
    from: "you@example.com",
    to: "r@example.com",
    subject: "Hi",
    react: <Hello name="Dave" />
  });

  assert.deepEqual(result, { id: "email_1" });
  const body = JSON.parse(requireCall(mock.calls, 0).body ?? "null");
  assert.equal("react" in body, false, "the react element must not reach the API");
  assert.match(body.html, /Hello/);
  assert.match(body.html, /Dave/);
  assert.match(body.html, /rebeccapurple/);
  assert.equal(body.subject, "Hi");
});

test("batch renders each item's `react`", async () => {
  const { mailtea, mock } = client({ json: { data: [{ id: "e1" }, { id: "e2" }] } });
  await mailtea.emails.batch([
    { from: "you@example.com", to: "a@example.com", subject: "A", react: <Hello name="Ada" /> },
    { from: "you@example.com", to: "b@example.com", subject: "B", html: "<p>plain</p>" }
  ]);

  const body = JSON.parse(requireCall(mock.calls, 0).body ?? "null");
  assert.equal("react" in body[0], false);
  assert.match(body[0].html, /Ada/);
  assert.equal(body[1].html, "<p>plain</p>");
});

test("react together with html is refused before any request is made", async () => {
  const { mailtea, mock } = client({ json: { id: "email_1" } });
  await assert.rejects(
    () =>
      mailtea.emails.send({
        from: "you@example.com",
        to: "r@example.com",
        subject: "Hi",
        html: "<p>hi</p>",
        react: <Hello name="Dave" />
      }),
    /Cannot provide 'react' together with 'html' or 'template'/
  );
  assert.equal(mock.calls.length, 0, "no request may be sent");
});

test("a payload without `react` is passed through untouched", async () => {
  const { mailtea, mock } = client({ json: { id: "email_1" } });
  await mailtea.emails.send({
    from: "you@example.com",
    to: "r@example.com",
    subject: "Hi",
    html: "<p>hi</p>"
  });
  const body = JSON.parse(requireCall(mock.calls, 0).body ?? "null");
  assert.deepEqual(body, {
    from: "you@example.com",
    to: "r@example.com",
    subject: "Hi",
    html: "<p>hi</p>"
  });
});
