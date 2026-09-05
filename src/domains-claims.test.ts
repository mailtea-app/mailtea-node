import test from "node:test";
import assert from "node:assert/strict";
import { Mailtea } from "./index.js";
import type {
  Domain,
  DomainClaim,
  DomainRecord,
  DomainRegion,
  DomainTlsPolicy,
  TrackingDomain,
  VerifiedDomainClaim
} from "./domains.js";
import { createMockFetch, requireCall } from "./test-utils.js";

function client(spec: Parameters<typeof createMockFetch>[0]) {
  const mock = createMockFetch(spec);
  return { mailtea: new Mailtea("mt_pat_test", { fetch: mock.fetch }), mock };
}

const PUB = "pub_123";

// --- claims ---------------------------------------------------------------

test("domains.claims.create POSTs /v1/domains/claim with the body", async () => {
  const { mailtea, mock } = client({
    json: { object: "domain_claim", id: "clm_1", status: "pending" }
  });
  const claim = await mailtea.domains.claims.create({
    publication_id: PUB,
    name: "acme.com",
    region: "eu-west-1"
  });
  assert.equal(claim.id, "clm_1");
  const call = requireCall(mock.calls, 0);
  assert.equal(call.method, "POST");
  assert.equal(call.url, "https://api.mailtea.app/v1/domains/claim");
  assert.deepEqual(JSON.parse(call.body ?? "null"), {
    publication_id: PUB,
    name: "acme.com",
    region: "eu-west-1"
  });
});

test("domains.claims.create sends no region when none is given", async () => {
  const { mailtea, mock } = client({ json: { object: "domain_claim", id: "clm_1" } });
  await mailtea.domains.claims.create({ publication_id: PUB, name: "acme.com" });
  assert.deepEqual(JSON.parse(requireCall(mock.calls, 0).body ?? "null"), {
    publication_id: PUB,
    name: "acme.com"
  });
});

test("domains.claims.get GETs the claim with publication_id in the query", async () => {
  const { mailtea, mock } = client({ json: { object: "domain_claim", id: "clm_1" } });
  await mailtea.domains.claims.get("clm_1", { publication_id: PUB });
  assert.equal(
    requireCall(mock.calls, 0).url,
    "https://api.mailtea.app/v1/domains/claims/clm_1?publication_id=pub_123"
  );
});

test("domains.claims.verify POSTs the verify sub-path", async () => {
  const { mailtea, mock } = client({ json: { object: "domain_claim", id: "clm_1" } });
  await mailtea.domains.claims.verify("clm_1", { publication_id: PUB });
  const call = requireCall(mock.calls, 0);
  assert.equal(call.method, "POST");
  assert.equal(
    call.url,
    "https://api.mailtea.app/v1/domains/claims/clm_1/verify?publication_id=pub_123"
  );
});

test("domains.claims.cancel DELETEs the claim", async () => {
  // `cancel`, not `delete`: withdrawing a request, not destroying a record.
  // The verb is still DELETE.
  const { mailtea, mock } = client({
    json: { object: "domain_claim", id: "clm_1", deleted: true }
  });
  const res = await mailtea.domains.claims.cancel("clm_1", { publication_id: PUB });
  assert.equal(res.deleted, true);
  const call = requireCall(mock.calls, 0);
  assert.equal(call.method, "DELETE");
  assert.equal(
    call.url,
    "https://api.mailtea.app/v1/domains/claims/clm_1?publication_id=pub_123"
  );
});

test("the claim id is URL-encoded", async () => {
  const { mailtea, mock } = client({ json: { object: "domain_claim", id: "x" } });
  await mailtea.domains.claims.get("clm/1", { publication_id: PUB });
  assert.match(requireCall(mock.calls, 0).url, /claims\/clm%2F1\?/);
});

test("the claim id is URL-encoded on verify and cancel too", async () => {
  const { mailtea, mock } = client({ json: { object: "domain_claim", id: "x" } });
  await mailtea.domains.claims.verify("clm/1", { publication_id: PUB });
  assert.match(requireCall(mock.calls, 0).url, /claims\/clm%2F1\/verify\?/);

  const { mailtea: m2, mock: mk2 } = client({
    json: { object: "domain_claim", id: "x", deleted: true }
  });
  await m2.domains.claims.cancel("clm/1", { publication_id: PUB });
  assert.match(requireCall(mk2.calls, 0).url, /claims\/clm%2F1\?/);
});

test("a claim response parses into the DomainClaim shape", async () => {
  const { mailtea } = client({
    json: {
      object: "domain_claim",
      id: "clm_1",
      publication_id: PUB,
      name: "acme.com",
      region: "eu-west-1",
      status: "pending",
      records: [
        {
          record: "Claim",
          type: "TXT",
          name: "_mailtea-claim.acme.com",
          value: "mailtea-claim=abc",
          status: "pending"
        }
      ],
      failure_reason: null,
      domain_id: null,
      expires_at: "2026-09-10T00:00:00.000Z",
      created_at: "2026-09-03T00:00:00.000Z",
      completed_at: null
    }
  });
  const claim: DomainClaim = await mailtea.domains.claims.get("clm_1", {
    publication_id: PUB
  });
  assert.equal(claim.expires_at, "2026-09-10T00:00:00.000Z");
  assert.equal(claim.domain_id, null);
  assert.equal(claim.failure_reason, null);
  const record = claim.records[0];
  assert.ok(record);
  assert.equal(record.record, "Claim");
  assert.equal(record.status, "pending");
});

test("a failed claim carries a refusal code in failure_reason", async () => {
  const { mailtea } = client({
    json: {
      object: "domain_claim",
      id: "clm_1",
      status: "failed",
      failure_reason: "claim_txt_mismatch"
    }
  });
  const claim = await mailtea.domains.claims.get("clm_1", { publication_id: PUB });
  assert.equal(claim.failure_reason, "claim_txt_mismatch");
});

test("a completed verify carries the domain it produced", async () => {
  const { mailtea } = client({
    json: {
      object: "domain_claim",
      id: "clm_1",
      status: "completed",
      domain_id: "dom_9",
      domain: { object: "domain", id: "dom_9", name: "acme.com", region: "eu-west-1" }
    }
  });
  const claim: VerifiedDomainClaim = await mailtea.domains.claims.verify("clm_1", {
    publication_id: PUB
  });
  assert.equal(claim.status, "completed");
  assert.equal(claim.domain.id, "dom_9");
});

// --- domain fields, inputs and filters ------------------------------------

test("domains.create forwards region, tls and tracking_subdomain", async () => {
  const { mailtea, mock } = client({ json: { object: "domain", id: "dom_1" } });
  await mailtea.domains.create({
    publication_id: PUB,
    name: "acme.com",
    purpose: "email",
    region: "ap-southeast-1",
    tls: "enforced",
    tracking_subdomain: "links"
  });
  assert.deepEqual(JSON.parse(requireCall(mock.calls, 0).body ?? "null"), {
    publication_id: PUB,
    name: "acme.com",
    purpose: "email",
    region: "ap-southeast-1",
    tls: "enforced",
    tracking_subdomain: "links"
  });
});

test("domains.update forwards tls and tracking_subdomain", async () => {
  const { mailtea, mock } = client({ json: { object: "domain", id: "dom_1" } });
  await mailtea.domains.update("dom_1", {
    publication_id: PUB,
    tls: "opportunistic",
    tracking_subdomain: "go"
  });
  const call = requireCall(mock.calls, 0);
  assert.equal(call.method, "PATCH");
  assert.equal(
    call.url,
    "https://api.mailtea.app/v1/domains/dom_1?publication_id=pub_123"
  );
  assert.deepEqual(JSON.parse(call.body ?? "null"), {
    publication_id: PUB,
    tls: "opportunistic",
    tracking_subdomain: "go"
  });
});

test("domains.list forwards the region and status filters", async () => {
  const { mailtea, mock } = client({ json: { object: "list", data: [], has_more: false } });
  await mailtea.domains.list({ publication_id: PUB, region: "eu-west-1", status: "verified" });
  const url = requireCall(mock.calls, 0).url;
  assert.match(url, /region=eu-west-1/);
  assert.match(url, /status=verified/);
});

test("domains.list omits the filters when they are not given", async () => {
  const { mailtea, mock } = client({ json: { object: "list", data: [], has_more: false } });
  await mailtea.domains.list({ publication_id: PUB });
  const url = requireCall(mock.calls, 0).url;
  assert.equal(url, "https://api.mailtea.app/v1/domains?publication_id=pub_123");
});

test("a list row without records/dkim_status/custom_return_path fields type-checks and parses", async () => {
  // toDomainListItem (apps/api/src/domains-rest.ts) omits records, dkim_status,
  // custom_return_path and custom_return_path_status from list rows — all four
  // must be optional on Domain, or this literal fails to compile.
  const { mailtea } = client({
    json: {
      object: "list",
      data: [
        {
          object: "domain",
          id: "dom_1",
          publication_id: PUB,
          name: "acme.com",
          status: "verified",
          purpose: "email",
          region: "us-west-1",
          tls: "opportunistic",
          tracking_subdomain: null,
          released_at: null,
          is_system: false,
          is_primary: true,
          proxy_target: "",
          verified_at: "2026-09-01T00:00:00.000Z",
          created_at: "2026-01-01T00:00:00.000Z",
          updated_at: "2026-09-01T00:00:00.000Z",
          open_tracking: true,
          click_tracking: true
        } satisfies Domain
      ],
      has_more: false
    }
  });
  const page = await mailtea.domains.list({ publication_id: PUB });
  assert.equal(page.data.length, 1);
  assert.equal(page.data[0]?.custom_return_path, undefined);
  assert.equal(page.data[0]?.custom_return_path_status, undefined);
});

test("a domain response parses the region, tls, tracking and release fields", async () => {
  const { mailtea } = client({
    json: {
      object: "domain",
      id: "dom_1",
      publication_id: PUB,
      name: "acme.com",
      status: "pending",
      purpose: "email",
      region: "ap-southeast-2",
      tls: "enforced",
      tracking_subdomain: "links",
      released_at: "2026-09-01T00:00:00.000Z",
      records: [
        {
          record: "DKIM",
          type: "CNAME",
          name: "abc._domainkey.acme.com",
          value: "abc.dkim.amazonses.com",
          ttl: "Auto",
          purpose: "dkim",
          status: "not_started"
        },
        {
          record: "MX",
          type: "MX",
          name: "acme.com",
          value: "inbound.mailtea.app",
          ttl: "Auto",
          priority: 10,
          purpose: "receiving",
          status: "pending"
        }
      ]
    }
  });
  const domain: Domain = await mailtea.domains.get("dom_1", { publication_id: PUB });
  const region: DomainRegion = domain.region;
  const tls: DomainTlsPolicy = domain.tls;
  assert.equal(region, "ap-southeast-2");
  assert.equal(tls, "enforced");
  assert.equal(domain.tracking_subdomain, "links");
  assert.equal(domain.released_at, "2026-09-01T00:00:00.000Z");

  const records = domain.records ?? [];
  const dkim = records[0];
  assert.ok(dkim);
  assert.equal(dkim.record, "DKIM");
  assert.equal(dkim.ttl, "Auto");
  assert.equal(dkim.status, "not_started");
  assert.equal(dkim.purpose, "dkim");
  const mx: DomainRecord | undefined = records[1];
  assert.ok(mx);
  assert.equal(mx.priority, 10);
});

test("a tracking domain reports whether it is attached to the edge", async () => {
  const { mailtea } = client({
    json: {
      object: "tracking_domain",
      id: "trk_1",
      domain_id: "dom_1",
      subdomain: "links",
      full_name: "links.acme.com",
      status: "verified",
      attached: false,
      records: [
        { type: "CNAME", name: "links.acme.com", value: "edge.mailtea.app", status: "verified" }
      ],
      verified_at: "2026-09-01T00:00:00.000Z",
      created_at: "2026-09-01T00:00:00.000Z",
      updated_at: "2026-09-01T00:00:00.000Z"
    }
  });
  const tracking: TrackingDomain = await mailtea.domains.tracking.verify("dom_1", "trk_1", {
    publication_id: PUB
  });
  assert.equal(tracking.attached, false);
  assert.equal(tracking.status, "verified");
});
