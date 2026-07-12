import test from "node:test";
import assert from "node:assert/strict";
import { Mailtea } from "./index.js";

// Live integration test against a running API. Opt-in: it self-skips unless
// MAILTEA_SDK_INTEGRATION=1 is set, so it never runs in CI by default.
//
//   MAILTEA_SDK_INTEGRATION=1 \
//   MAILTEA_API_KEY=mt_pat_xxx \
//   MAILTEA_SDK_BASE_URL=http://localhost:8787 \
//   MAILTEA_SDK_FROM="you@yourdomain.com" \
//   MAILTEA_SDK_TO="delivered@example.com" \
//   pnpm --filter mailtea test

const enabled = process.env.MAILTEA_SDK_INTEGRATION === "1";

test(
  "sends a real email and reads it back",
  { skip: enabled ? false : "set MAILTEA_SDK_INTEGRATION=1 to run" },
  async () => {
    const apiKey = process.env.MAILTEA_API_KEY;
    const baseUrl = process.env.MAILTEA_SDK_BASE_URL ?? "http://localhost:8787";
    const from = process.env.MAILTEA_SDK_FROM ?? "you@example.com";
    const to = process.env.MAILTEA_SDK_TO ?? "delivered@example.com";
    assert.ok(apiKey, "MAILTEA_API_KEY is required for the integration test");

    const mailtea = new Mailtea(apiKey, { baseUrl });

    const sent = await mailtea.emails.send({
      from,
      to,
      subject: "Mailtea SDK integration test",
      html: "<p>Hello from the SDK integration test.</p>"
    });
    assert.ok(sent.id, "expected a non-empty email id");

    const fetched = await mailtea.emails.get(sent.id);
    assert.equal(fetched.id, sent.id);
    assert.ok(fetched.status, "expected a delivery status");

    const listed = await mailtea.emails.list({ limit: 20 });
    assert.ok(listed.total >= 1, "expected at least one email in the list");
    assert.ok(
      listed.data.some((email) => email.id === sent.id),
      "the sent email should appear in emails.list"
    );
  }
);
