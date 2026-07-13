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
| `contacts.create / list / get / update / delete` | Manage audience contacts |
| `segments.create / list / get / update / delete` | Manage segments |
| `tags.create / list / get / update / delete` | Manage tags |
| `domains.create / list / get / verify / update / delete` | Manage sending domains (add, read DNS records, verify) |
| `domains.tracking.create / list / verify / delete` | Manage CNAME tracking sub-domains under a domain |
| `webhooks.create / list / get / update / delete` | Manage outbound event subscriptions |
| `contactProperties.create / list / update / delete` | Manage custom contact fields (team-scoped) |
| `apiKeys.create / list / revoke` | Manage API keys (`settings:write`) |

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

Errors are thrown as `MailteaError` with `status`, `details`, and `requestId`.

## License

MIT — embed it freely in your apps.
