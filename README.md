# mailtea-sdk

The official Node.js SDK for [Mailtea](https://mailtea.app) — a thin, typed
wrapper over the [REST API](https://api.mailtea.app). Works in Node.js 18+, Bun,
Deno, and edge runtimes with a global `fetch`.

## Install

```bash
npm install mailtea-sdk
```

## Usage

```ts
import { Mailtea } from "mailtea-sdk";

const mailtea = new Mailtea(process.env.MAILTEA_API_KEY);

const { id } = await mailtea.emails.send({
  from: "you@yourdomain.com",
  to: "recipient@example.com",
  subject: "Hello from Mailtea",
  html: "<p>Your first email, sent with <strong>Mailtea</strong>.</p>"
});

console.log(id);
```

The API key can be passed as a string, inside an options object
(`new Mailtea({ apiKey })`), or omitted entirely to read `MAILTEA_API_KEY` from
the environment. Override the base URL for self-hosted or local instances:

```ts
const mailtea = new Mailtea(apiKey, { baseUrl: "http://localhost:8787" });
```

## API

| Method | Description |
| --- | --- |
| `emails.send(input)` | Send a transactional email → `{ id }` |
| `emails.batch(inputs)` | Send up to 100 emails → `{ data: [{ id }] }` |
| `emails.get(id)` | Retrieve an email and its delivery status |
| `emails.list(params?)` | List emails → `{ data, total, limit, offset, has_more }` |
| `emails.analytics(params?)` | Aggregate metrics → `{ total, sent, delivered, opened, clicked, rates }` |
| `emails.update(id, { scheduled_at })` | Reschedule a scheduled email |
| `emails.reschedule(id, scheduledAt)` | Convenience wrapper over `update` |
| `emails.cancel(id)` | Cancel a scheduled email |
| `contacts.create / upsert / list / get / update / delete` | Manage audience contacts (`upsert` = `create`; the endpoint upserts) |
| `posts.create(input)` | Create a newsletter post (draft, or `send: true`) → `{ id }` |
| `posts.send(id, { scheduled_at? })` | Send a draft post to the audience, now or scheduled |
| `posts.sendTest(id, input)` | Send a `[TEST]` copy of a post → `{ sent_to, failed_to }` |
| `posts.list / get / update / delete` | Manage posts (list is offset-based; update/delete draft-only) |
| `segments.create / list / get / update / delete` | Manage segments |
| `tags.create / list / get / update / delete` | Manage tags |
| `senders.create / list / get / update / delete` | Manage named from-identities on verified sending domains |
| `domains.create / list / get / verify / update / delete` | Manage sending domains (add, read DNS records, verify) |
| `domains.tracking.create / list / verify / delete` | Manage CNAME tracking sub-domains under a domain |
| `suppressions.list / add / remove / export` | Org-wide suppression list (`export` returns CSV text) |
| `templates.render / create / list / get / update / publish / duplicate / delete` | Manage stored email templates (`render` previews a spec without saving) |
| `templates.listVersions / restoreVersion` | Template version history (newest 50). **A restore returns the template to `draft`** — sends stop until it is published again |
| `webhooks.create / list / get / update / delete` | Manage outbound event subscriptions |
| `contactProperties.create / list / update / delete` | Manage custom contact fields (team-scoped) |
| `apiKeys.create / list / revoke` | Manage API keys (`settings:write`) |
| `automations.create / list / get / update / delete` | Manage automations — a versioned graph of `steps` + `connections` |
| `automations.validate(input)` | Dry-run a graph that does not exist yet → `{ valid, issues }` |
| `automations.activate / pause / archive` | Lifecycle. `pause` keeps in-flight runs by default; `archive` cancels them by default |
| `automations.listVersions / getVersion` | Version history (in-flight runs pin to the version they started on) |
| `automations.metrics(id, params)` | Per-step funnel, branch splits and send stats (test runs excluded) |
| `automations.test(id, input)` | Run once against a real contact — sends a real, billed email |
| `automationRuns.list / get / cancel` | Inspect a contact's journey; run detail carries its pinned graph |
| `events.send / list` | Custom event ingest (202) and the queryable event log |
| `eventDefinitions.create / list / get / update / delete` | Event catalog; `get` returns `inferred_properties` with coverage |

`emails.send` and `emails.batch` accept an options argument to set an
idempotency key: `mailtea.emails.send(input, { idempotencyKey: "order-42" })`.

The audience resources are scoped to a publication — pass `publication_id`:

```ts
const contact = await mailtea.contacts.create({
  publication_id: "pub_123",
  email: "subscriber@example.com"
});

const { data } = await mailtea.contacts.list({ publication_id: "pub_123", limit: 50 });

await mailtea.tags.create({
  publication_id: "pub_123",
  name: "VIP",
  default_subscription: "opt_in"
});
```

Automations are authored as data, so an agent can generate one. `connections` is optional —
omit it and the steps link in array order; it becomes required as soon as the graph contains a
`condition` or `wait_for_event` step, since array order cannot say which branch a step belongs
to. Pass `validate_only: true` to get the issues back without writing anything:

```ts
const check = await mailtea.automations.create({
  publication_id: "pub_123",
  name: "Welcome series",
  validate_only: true,
  steps: [
    { key: "start", type: "trigger", config: { trigger_type: "contact.subscribed" } },
    { key: "wait", type: "delay", config: { duration: 1, unit: "days" } },
    { key: "welcome", type: "send_email", config: { template_id: "tmpl_123" } }
  ]
});

if (check.valid) {
  const automation = await mailtea.automations.create({ ...input });
  await mailtea.automations.activate(automation.id, { publication_id: "pub_123" });
}
```

Errors are thrown as `MailteaError` with `status`, `details`, and `requestId`. Automation and
event failures also carry a machine-readable `issues` array (each with a stable `code`, a
`severity`, and the offending `step_key` / `path`) so a client can correct a graph
programmatically instead of parsing prose.

## License

MIT — embed it freely in your apps.
