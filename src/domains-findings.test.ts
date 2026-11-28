import test from "node:test";
import assert from "node:assert/strict";
import { Mailtea } from "./index.js";
import type { DomainRecord, DomainRecordRole } from "./domains.js";
import { createMockFetch } from "./test-utils.js";

const records = [
  {
    record: "Ownership",
    type: "TXT",
    name: "_mailtea.news.example.com",
    value: "mailtea-verify=abc",
    ttl: "Auto",
    status: "pending",
    found_value: null,
    next_step: "Add this TXT record at your DNS provider."
  },
  {
    record: "DMARC",
    type: "TXT",
    name: "_dmarc.news.example.com",
    value: "v=DMARC1; p=none;",
    ttl: "Auto",
    purpose: "dmarc",
    status: "verified",
    found_value: "v=DMARC1; p=quarantine;",
    next_step: null
  }
];

test("domains.get returns records with found_value and next_step, and a DMARC role", async () => {
  const mock = createMockFetch({ json: { object: "domain", id: "dom_1", records } });
  const mailtea = new Mailtea("mt_pat_test", { fetch: mock.fetch });
  const domain = await mailtea.domains.get("dom_1", { publication_id: "pub_1" });

  const [first, last] = domain.records ?? [];
  assert.equal(first?.found_value, null);
  assert.equal(first?.next_step, "Add this TXT record at your DNS provider.");
  assert.equal(last?.record, "DMARC");
  assert.equal(last?.purpose, "dmarc");
  assert.equal(last?.found_value, "v=DMARC1; p=quarantine;");
  assert.equal(last?.next_step, null);
});

test("the new record fields are optional and DMARC is a record role", () => {
  // Type-level: a record from an older server, with neither field, still fits,
  // and `DMARC` is a role the compiler accepts.
  const role: DomainRecordRole = "DMARC";
  const old: DomainRecord = {
    record: role,
    type: "TXT",
    name: "_dmarc.example.com",
    value: "v=DMARC1; p=none;",
    status: "pending"
  };
  assert.equal(old.next_step, undefined);
  assert.equal(old.found_value, undefined);
});
