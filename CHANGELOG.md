# Changelog

All notable changes to `mailtea-sdk` are documented here.

## 0.4.0 (2026-07-27)

### Added

- **Designed templates — `format: "editor"`.** `templates.create` and `templates.update` accept `editor_doc`, the TipTap document the Visual Email Designer writes, and the server renders and stores the email HTML from it. This is what makes a template designed in Mailtea Studio and one authored from code the same record: previously the design source lived only in the operator's browser and the API could only take raw `html` or a json-render `spec`. Do **not** send `html` alongside `editor_doc` — the HTML is derived, and an update that tries it is refused with `editor_template_html_not_accepted`.
- **The fidelity sidecars `html` cannot carry** — `style_profile`, `mailtea_theme` and `global_css` on create and update, and returned on `Template`. Without them a template can be sent but not faithfully reopened. On update a patch carrying only `editor_doc` keeps the stored sidecars, and a patch carrying only a sidecar re-renders the HTML from the stored document.
- **Library metadata** — `category`, `preview_image_url` and `tags` on create, update, `Template` and `TemplateListItem`. Present on the list projection so a gallery renders from one page rather than a GET per row. These are gallery tags, unrelated to contact tags.
- **`templates.unpublish(id, { publication_id })`** — the retraction half of `publish`. Publishing was one-way: the only way to take a template out of circulation was to delete it or edit its body. `status` returns to `draft` and the body is untouched; `published_at` is kept, because it records that the template *was* published, which is history rather than current state.
- `TemplateFormat` is exported and narrowed to `"html" | "spec" | "editor"`; `EditorDocument` types the document root.

### Changed

- `POST /v1/templates/render` (`templates.render`) now actually substitutes the `variables` map it has always accepted. The server parsed the map and discarded it, so a preview came back full of raw `{{placeholders}}` while every other render path substituted. No SDK signature changes — the same call now returns the rendered result it documented.
- `templates.render` now requires the `templates:read` scope. It was the only template route with no scope check at all. Keys minted from the `read_only` or `sending_access` presets hold no `templates:*` scope and will now receive a `403`; they could not list, read or create templates before either, so this closes an inconsistency rather than removing a workflow.

## 0.3.0 (2026-07-27)

### Added

- **Automations resource** — `automations.create / list / get / update / delete`, the lifecycle verbs `automations.activate / pause / archive`, version history via `automations.listVersions / getVersion`, `automations.metrics` and `automations.test`. An automation is a versioned graph of `steps[]` + `connections[]` with no stored coordinates, so it is fully authorable from code. `connections` is **optional**: omit it and the steps link in array order with branch `next`; it becomes required as soon as the graph contains a `condition` or `wait_for_event` step, which otherwise fails with `connections_required_for_branching`.
- **Graph validation without saving** — `automations.validate({ publication_id, steps, connections })` dry-runs a graph that does not exist yet, and `validate_only: true` on `create` / `update` returns the same structured `issues[]` a real failure would, writing nothing. Both are typed with overloads, so `validate_only: true` narrows the return type to `AutomationValidation`. Every issue carries a stable `code`, a `severity`, and the offending `step_key` / `path` — warnings never block saving, errors block activation.
- **Automation runs resource** — `automationRuns.list / get / cancel`. Run detail is self-contained: it returns the graph the run is **pinned** to (which may not be the live one), the ordered step timeline, and the waiting state, so a replay never renders against a graph the run never traversed.
- **Events resource** — `events.send` (custom event ingest, 202, with `idempotency_key` and opt-in `create_contact`) and `events.list`, plus `eventDefinitions.create / list / get / update / delete`. The definition detail returns `inferred_properties` with per-key type, sample count and **coverage**, computed on read over the last 500 events.
- **`search` on `emails.list`** — `ListEmailsParams.search` is a case-insensitive substring match over recipient, sender and subject, applied server-side **before** pagination. Previously the only way to find an email by subject was to page through the whole list. Shipped server-side on 2026-07-22, one day after 0.2.0 went out, so this is the first published release that carries it.
- **Automation lifecycle webhook events** on `WebhookEvent`, so an endpoint can subscribe to them through `webhooks.create` / `webhooks.update`: `automation.run.started`, `automation.run.completed`, `automation.run.failed`, `automation.run.exited` and `automation.step.completed`. `automation.run.exited` is deliberately distinct from `completed` — it carries the `exit_reason` for a contact who left a journey early (unsubscribed, suppressed, archived) rather than reaching its end. `automation.step.completed` fires for side-effecting steps only (sends, tag changes, contact updates), never for conditions or delays.
- **Per-topic subscription webhook events** on `WebhookEvent`: `contact.tag_subscribed` and `contact.tag_unsubscribed`, the granular sibling of `contact.unsubscribed` — a reader leaving one topic is not leaving the publication. Both carry `tag_id`, `previous_status`, `status`, `source` and `occurred_at`. They fire only on a genuine change in EFFECTIVE tag membership (a tag with an `opt_out` default already counts as subscribed, so re-asserting that default emits nothing), which is what makes them safe to drive a downstream sync from.

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
