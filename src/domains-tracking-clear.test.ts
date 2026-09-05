import test from "node:test";
import assert from "node:assert/strict";
import { Mailtea } from "./index.js";
import type { CreateDomainInput, UpdateDomainInput } from "./domains.js";
import { createMockFetch, requireCall } from "./test-utils.js";

function client(spec: Parameters<typeof createMockFetch>[0]) {
  const mock = createMockFetch(spec);
  return { mailtea: new Mailtea("mt_pat_test", { fetch: mock.fetch }), mock };
}

const PUB = "pub_123";

test("domains.update sends tracking_subdomain: null when clearing", async () => {
  // The clear has to reach the wire AS null. An SDK that dropped falsy values
  // on their way into the body would turn "remove it" into "leave it alone",
  // and the caller would get a 200 saying nothing happened.
  const { mailtea, mock } = client({ json: { object: "domain", id: "dom_1" } });
  await mailtea.domains.update("dom_1", { publication_id: PUB, tracking_subdomain: null });
  assert.deepEqual(JSON.parse(requireCall(mock.calls, 0).body ?? "null"), {
    publication_id: PUB,
    tracking_subdomain: null
  });
});

test("domains.update still sends a named tracking subdomain", async () => {
  const { mailtea, mock } = client({ json: { object: "domain", id: "dom_1" } });
  await mailtea.domains.update("dom_1", { publication_id: PUB, tracking_subdomain: "links" });
  assert.deepEqual(JSON.parse(requireCall(mock.calls, 0).body ?? "null"), {
    publication_id: PUB,
    tracking_subdomain: "links"
  });
});

test("omitting tracking_subdomain sends no key at all", async () => {
  // Three states, not two: absent leaves the subdomain alone, null removes it.
  // A body that always carried the key would clear it on every unrelated PATCH.
  const { mailtea, mock } = client({ json: { object: "domain", id: "dom_1" } });
  await mailtea.domains.update("dom_1", { publication_id: PUB, tls: "enforced" });
  const body = JSON.parse(requireCall(mock.calls, 0).body ?? "null") as Record<string, unknown>;
  assert.equal("tracking_subdomain" in body, false);
});

test("null is an update-only value: create still takes a string", () => {
  // A type-level assertion, so the compiler is what fails if either input
  // drifts. On a create there is nothing to clear, and a schema advertising
  // null there would teach a caller a distinction the product does not have.
  const clearing: UpdateDomainInput = { publication_id: PUB, tracking_subdomain: null };
  assert.equal(clearing.tracking_subdomain, null);

  const creating: CreateDomainInput = { publication_id: PUB, name: "acme.com" };
  // @ts-expect-error — `null` is not accepted on create.
  creating.tracking_subdomain = null;
  assert.equal(creating.tracking_subdomain, null);
});
