# Changelog

All notable changes to `mailtea-sdk` are documented here.

## 0.2.0 (2026-07-21)

### Added

- **Senders resource** — `senders.create / list / get / update / delete` for named from-identities on verified sending domains, and `sender_id` on `emails.send` as an alternative to `from` (exactly one of the two).
- **Suppressions resource** — `suppressions.list / add / remove` for the org-wide do-not-send list, plus `suppressions.export()` returning the full list as CSV text.
- **Templates resource** — `templates.create / list / get / update / publish / duplicate / delete`, and `templates.render(spec)` to preview a template spec as `{ html, text }` without saving anything.
- **Full posts CRUD** — `posts.list` (offset-based), `posts.get`, `posts.update`, `posts.delete`, and the missing `text` / `from` / `reply_to` / `name` fields on `posts.create`.
- **Idempotent sending** — `emails.send(input, { idempotencyKey })` and `emails.batch(inputs, { idempotencyKey })` set the `Idempotency-Key` header so retries never double-send.

### Changed

- **Domain types match the API again** — `Domain` gains `is_system` and `dkim_status`; DNS records gain `priority` (MX) and `purpose` (`"dkim"` / `"receiving"`) and can report a `failed` status; `domains.verify()` now types `receiving_mx_found`. DKIM is a single branded TXT record on your own domain.

## 0.1.2 (2026-07-14)

- Aligned the SDK surface with the documented interface (inbound, analytics, webhook signing).

## 0.1.1 (2026-07-13)

- Renamed the npm package `@mailtea-app/sdk` → `mailtea-sdk`.

## 0.1.0 (2026-07-13)

- Initial public release: emails (send, batch, schedule, analytics), contacts, posts, segments, tags, domains, webhooks, contact properties, API keys.
