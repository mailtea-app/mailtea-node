# Changelog

## Unreleased

- Added: `image/svg+xml` is an accepted asset type for `assets.upload` — SVG
  logos and marks upload like any raster. The public asset route serves every
  asset with `Content-Security-Policy: sandbox`, which is what makes hosting
  SVGs safe: scripts inside one never execute, in an `<img>` or navigated to
  directly.


All notable changes to `mailtea-sdk` are documented here.

## 0.8.0 (2026-08-06)

### Added

- **`mailtea.assets` — the publication's image library.** `upload`, `list` and
  `delete`. An email or site image block takes an absolute URL, so until now an
  SDK caller could compose a whole newsletter and had no way to put a picture in
  it; the library was reachable only from the studio, MCP and the CLI.

  ```ts
  const asset = await mailtea.assets.upload({
    publication_id: "pub_123",
    content: await readFile("hero.png"),   // Buffer/Uint8Array, encoded for you
    content_type: "image/png",
    filename: "hero.png",
    width: 1200,
    height: 452
  });
  asset.url; // -> use as an image block's src
  ```

  `content` also accepts an already-base64 string. PNG, JPEG, GIF or WebP, 5 MB
  per image, 500 MB per publication. **SVG is refused** — it can carry script and
  the file is served from a Mailtea domain — and the bytes are checked against
  the declared `content_type`, so a mislabelled file is rejected rather than
  stored. `delete` hides an asset from the library but KEEPS the file resolving,
  so images in already-sent emails do not break.

## 0.7.0 (2026-08-02)
### Added

- **Send React Email components — `react` on `emails.send()` and on each `emails.batch()` item.** Pass a JSX element instead of an `html` string and the SDK renders it to HTML **in your process**, before the request leaves:

  ```tsx
  import { Mailtea } from "mailtea-sdk";
  await mailtea.emails.send({
    from: "Acme <hello@acme.com>",
    to: "customer@example.com",
    subject: "Welcome",
    react: <Welcome name="Dave" />
  });
  ```

  The API only ever receives `html` — there is no new server behaviour and nothing to upgrade on the account. Anything React Email renders works, including `<Tailwind>`: its utility classes are inlined at render time, and the media queries it cannot inline survive in the `<style>` block.

  **`@react-email/render` and `react` are OPTIONAL peer dependencies.** They are loaded with a lazy `import()` the first time a `react` payload is sent, so a project that never uses the field installs `mailtea-sdk` with **no dependencies at all** — unchanged from 0.6.0. If the field is used without them installed, the SDK throws with the install command rather than failing at the network layer.

  `react` is mutually exclusive with `html` and `template`; combining them throws a `TypeError` before any request is made. Batch items support `react` (they still do not support `attachments` or `scheduled_at`).

- `ReactEmailElement`, the structural element type the `react` field accepts. Deliberately structural rather than `React.ReactElement` so the published types pull in no React dependency; a JSX element satisfies it.

- **`MailteaError.code` is now populated from the API's error body.** It has always existed for client-side failures (`missing_api_key`, `missing_fetch`); it was never filled in for HTTP errors, so branching on a specific API error meant string-matching `error.message` — which breaks the day the copy changes. Now, when the API sends a `code` alongside `error`, the SDK carries it through:

  ```ts
  try {
    await mailtea.contacts.list({ publication_id: "pub_123" });
  } catch (err) {
    if (err instanceof MailteaError && err.code === "marketing_plan_required") {
      // the team is on a transactional-only plan
    }
  }
  ```

  Purely additive: `code` stays `undefined` for the errors that carry no code, and `message`, `status`, `details` and `requestId` are unchanged.

### Changed

- **Marketing endpoints answer `402` on a transactional-only plan.** Server-side change, no SDK code change — recorded here because it is a new failure mode for existing calls. `contacts`, `contactProperties`, `segments`, `topics`, `posts` and `automations` now reject with HTTP `402` and `code: "marketing_plan_required"` when the API key belongs to a team on one of the transactional-column SKUs (`hobby`, `pro_25k`, `pro_50k`, `pro_100k`, `scale_250k`, `scale_500k`, `scale_1m`). `emails`, `domains`, `senders`, `suppressions`, `templates`, `events`, `webhooks` and `apiKeys` are unaffected on every plan. Nothing is deleted while a plan is transactional-only — upgrading to the matching `_full` SKU restores access to data already stored.

## 0.6.0 (2026-07-29)
### Changed

- **BREAKING — the audience concept is now a `topic`, not a `tag`.** `mailtea.tags` is now `mailtea.topics` and hits `/v1/topics`; `Tag`, `CreateTagInput`, `UpdateTagInput`, `ListTagsParams` and `TagSubscription` are now `Topic`, `CreateTopicInput`, `UpdateTopicInput`, `ListTopicsParams` and `TopicSubscription`. `object` on the returned resource is `"topic"`. There is no `/v1/tags` alias — the old path is gone.
  **Topic ids keep their `tag_` prefix.** It is opaque and permanent: ids are foreign-keyed, embedded in stored automation graphs, and carried in the `?tag=` List-Unsubscribe links of already-delivered mail. Never parse it.
  "Tag" now means only the Resend-compatible `tags: [{name, value}]` metadata on `emails.send()` and the `tag_name` / `tag_value` filters on `emails.list()`. Those are **unchanged**.
- **Webhook events renamed.** `contact.tag_subscribed` / `contact.tag_unsubscribed` are now `contact.topic_subscribed` / `contact.topic_unsubscribed`, and the payload field `tag_id` is now `topic_id`. A handler written as `if (event.type === "contact.tag_subscribed")` stops matching — update it before upgrading.
- **Automation graph vocabulary renamed.** Step types `tag_add` / `tag_remove` → `topic_add` / `topic_remove`; trigger types `tag.subscribed` / `tag.unsubscribed` → `topic.subscribed` / `topic.unsubscribed`; the step config key `tag_id` → `topic_id`; the condition field `contact.tags` → `contact.topics`; validation codes `tag_not_found` / `tag_unverified` → `topic_not_found` / `topic_unverified`. The API **accepts both spellings on write forever** and canonicalizes on read, so an existing automation keeps running — but `automations.get()` returns the new spelling even for a graph stored with the old one.
- **`TemplateVariable.key` now has a shape, and the API enforces it.** `POST /v1/templates` and `PATCH /v1/templates/:id` refuse a key outside `^[A-Za-z_$@][A-Za-z0-9_$@.-]*$` (1–50 chars) with a `400`; one invalid key fails the whole write. No SDK code change — `key` is still `string` on the wire and the new refusal surfaces as an ordinary API error — but the type now documents the rule, because a name outside it was previously accepted, stored, returned by `templates.get()` looking declared, and then substituted **nowhere**: a send resolves a variable by path, so `Hi {2nd name},` reached the inbox with its braces. Dots address into send context (`contact.first_name`) and dashes are legal (`plan-tier`); pipes, spaces, braces and a leading digit are not.

### Added

- **`AutomationStepType` gains `segment_add` and `segment_remove`.** Two new side-effecting steps that move the enrolled contact in and out of an audience segment; both take `config: { segment_id }`. They matter now because segment membership decides who a send targeting that segment reaches — before that it was a stored list with no reader on the delivery path.
- A segment is a **member list** (no filter) or a **filter** (`status_filter` / `query_filter`), never both, so **`segment_add` accepts member-list segments only**. Targeting a filter-backed segment is a new `segment_is_filter` validation error that blocks activation, and the step refuses again at run time — a segment can be given a filter after the automation goes live, and writing then would create the ambiguous both-kinds segment that refuses to send at all. `segment_remove` accepts either kind: it can only delete membership, so it cannot create that state, and on an already-mixed segment it is one of the ways out. A `segment_id` that does not resolve in the publication is `segment_not_found`.
- `AutomationStepRun.output` for these steps carries `segment_id` and `status` (`"added"` / `"removed"`), and both emit `automation.step.completed`.
- **Template version history — `templates.listVersions(id, params)`.** A template's history, newest first: `version`, `origin` (`edit` | `publish` | `restore`), `author`, `sealed`, and `is_current` for the entry whose design the template is actually sending — which is not necessarily the newest, because a metadata-only update bumps the template without writing a version. Metadata only; a single version can carry half a megabyte of design document. Deliberately **not** the standard list envelope: history is capped rather than paginated, so there is no cursor and the response carries `retention` instead — only the newest **50** versions are kept, and consecutive edits by the same author within **10 minutes** collapse into one version.
- **`templates.restoreVersion(id, version, { publication_id })`.** **A restore is a content write, so it returns the template to `draft` — automations and the API STOP sending it until it is published again.** The response reports that in `unpublished`, so a caller that reads nothing else still learns its own call stopped the sends. History is forward-only: a restore does not rewind, it records the state it replaced as its own version and then adds the restored design as a new version, so a restore can itself be undone by restoring the entry above the one you restored. Restoring the design that is already current writes nothing and answers `restored: false` with `reason: "identical"` — a live template keeps sending.
- Types for both: `TemplateVersion`, `TemplateVersionOrigin`, `TemplateVersionAuthor`, `TemplateVersionRetention`, `TemplateVersionList`, `ListTemplateVersionsParams` and `RestoredTemplateVersion`.

## 0.5.0 (2026-07-28)

### Added

- **`graph_version` / `graph_version_id` on `AutomationMetrics`.** The response now names two versions rather than conflating them: `version` is what the numbers are **scoped** to, `graph_version` is only which graph supplied `steps[].label`. They are equal whenever a `version` was requested, and only the second is set for an all-versions aggregate. Without the split there was no way to say "labels from v4" without a client reading it as "these counts are v4's".

### Changed

- **`AutomationMetrics.version` is now `null` for an all-versions aggregate.** It previously carried the live version number when no `version` was requested — a specific version stamped on counts that span every version, which let a caller title a funnel "Version 4" over combined v1-through-v4 traffic. The type was already `number | null`, so no signature changes; callers that print the version must now render an "all versions" label when it is `null` rather than assuming a number.
- **`AutomationStepEmailMetrics.delivered` now means CURRENTLY delivered** — accepted and not subsequently bounced. A mailbox that accepts a message and later rejects it leaves both timestamps set, and counting it in both buckets could make `delivered + bounced` exceed `sent`. That message now counts under `bounced` only, so the funnel can no longer report more outcomes than sends.
- **`AutomationMetrics.steps[]` is keyed on (`step_key`, `step_type`), not `step_key` alone.** A step key is unique only within a version, so an all-versions aggregate can now contain two entries sharing a `step_key` — a key deleted as a `condition` and later re-added as a `send_email` is two different steps. Previously the second silently overwrote the first, putting a send funnel on a fork. **Code that indexes `steps[]` by `step_key` must index on the pair**, or it will drop one of the two.
- `AutomationStepRun.output` documents `recorded_after_run_ended`, a key that can now appear on **any** step type. It marks a side effect that completed after its run ended (an operator cancel, an archive or a mid-run unsubscribe landing between dispatch and result). Those attempts were previously discarded, so a run's timeline showed no send for an email that had been sent and billed; they are now recorded and counted in metrics. Such a step run's `completed_at` is legitimately later than the run's own, and no `automation.step.completed` webhook fires for it.

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
