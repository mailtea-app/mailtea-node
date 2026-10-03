# Changelog

All notable changes to `mailtea-sdk` are documented here.

## Unreleased

- Changed (API): `posts.send`, and `posts.create` with `send: true`, send to
  the whole audience. They used to stop at 10,000 recipients without saying
  so. One send can reach at most 25,000; a larger audience is refused with a
  422 `audience_too_large` that carries `audience_count` and
  `max_recipients`, and nothing is sent or scheduled. On `posts.create` the
  error body carries the draft's `id`. A send also answers 409 `post_changed`
  when the post was scheduled or edited elsewhere (for example in Mailtea
  Studio) while the request was preparing it, instead of sending it anyway.
  No package change: this is the API's behaviour once it is deployed.

## 0.21.0 (2026-10-03)

- Changed (API): `posts.send`, and `posts.create` with `send: true`, now fail
  with a 403 `system_domain_recipient_restricted` (with `restriction`) when
  the team has no verified sending domain and the audience includes anyone
  outside the team, or the post sends from the built-in `*.mailtea.email`
  address. Nothing is sent or scheduled and the post stays a draft; on
  `posts.create` the error body carries the draft's `id`. The send used to be
  accepted and fail a moment later. A broadcast (`kind: "broadcast"`) is never
  published to the website, however it is sent. No package change: this is
  the API's behaviour once it is deployed.

## 0.20.0 (2026-10-01)

- Changed (API): `contacts.list({ search })` with several whole addresses
  separated by commas, spaces or line breaks now returns exactly those
  contacts (up to 200), the same as Mailtea Studio and MCP. A list with an
  entry that is not a whole address is refused with a 400 naming it. Part of
  an address still matches as before. The `search` field documents this.
- Added: `"domain_managed"` to `DomainRefusalCode`. `domains.update` on the
  Mailtea-managed domain (`<slug>.mailtea.email`) is now refused with it (400)
  instead of changing a domain Mailtea runs. Needs the API deployed with this
  change.
- Added: `CreateDomainClaimInput.purpose` (`"email"`, `"site"` or `"both"`,
  default `"email"`) and `DomainClaim.purpose`. A claim now creates the domain
  with that purpose, so a website-only domain no longer needs a `domains.update`
  afterwards, and a `"site"` claim gets no sending identity. Claims opened
  before this change report `"email"`. Needs the API deployed with this change.
- Added: `Post.segment_id`, `CreatePostInput.segment_id` and
  `UpdatePostInput.segment_id` (`null` clears it). A post with a segment goes
  to that segment's active contacts instead of all active contacts; the
  segment must be in the post's publication, or the request is refused with a
  422. The segment is resolved when the post is sent, and a send to a segment
  that cannot be resolved or matches nobody is refused rather than widened to
  the whole list. A segment that a draft, scheduled or sending post targets
  cannot be deleted: `segments.delete` fails with a 409 `segment_in_use`, so
  point those posts at another segment or clear their `segment_id` first. Deleting one used to send those posts to everyone.
- Added: `Segment.inactive_days`, `CreateSegmentInput.inactive_days` and
  `UpdateSegmentInput.inactive_days` (`null` clears it): contacts with no open
  or click in the last N days (1 to 3650), counting contacts who never
  engaged. It selects the silent cohort, not engaged readers. Engagement
  tracking is not backfilled, so contacts with no recorded engagement count
  as inactive. Both need the API deployed with this change; this release adds
  the fields to the types.

## 0.19.0 (2026-09-29)

- Changed: `DkimStatus` includes `"revoked"`, which the API already returns in
  `dkim_status` for a domain Mailtea revoked after abuse. Such a domain can't
  send, and saving or re-adding it keeps it revoked. Code that switches over
  `DkimStatus` without a default should handle the new value.
- Added: `TemplateVersion.from`, `TemplateVersion.reply_to` and
  `TemplateVersion.sender_recorded`. Template history now records the sender:
  an update that changes only `from` or `reply_to` records a version (or folds
  into the open one, like any edit), and `templates.restoreVersion` brings the
  version's From and Reply-To back. `sender_recorded` says what a `null`
  means. When it is true the version had no From or Reply-To, and restoring it
  clears them. When it is false the version was recorded before this change,
  and restoring it leaves the current From and Reply-To alone. The server
  change reaches every SDK version on deploy; this release only adds the
  fields to the type.

## 0.18.0 (2026-09-28)

- Added: optimistic-concurrency tokens for editing over an API that may also
  be edited in Mailtea Studio or by another agent. `Template.revision` moves
  on every content-changing write; pass it back as `base_revision` on
  `templates.update` and `templates.publish` to get a 409 `stale_write`
  (`current_revision` on the error) instead of silently overwriting someone
  else's edit. `automations.update` takes `base_version` the same way for
  graph writes (`steps`), answering 409 `stale_version`. `Post.updated_at` is
  now returned by `posts.get`/`posts.list`/`posts.update`; pass it back as
  `base_updated_at` on `posts.update` for a 409 `stale_write`
  (`current_updated_at` on the error). Every token is optional: omit it for
  today's unconditional write.
- Added: `Post.from` and `Post.reply_to`, the From and Reply-To set on a post
  (`null` when the named sender or the publication default decides). The API
  now keeps the `from` and `reply_to` you pass to `posts.create` and
  `posts.update` instead of dropping them.
- Changed: `name` on `posts.create` / `posts.update` is only the post's internal
  name and no longer overwrites the subject. `posts.update` changes only the
  fields you pass, and `""` clears `name`, `from` or `reply_to`.
- Note: a `from` that is not on one of the publication's verified sending
  domains is now refused with a 422 (the same `reason`, `code` and `domain` as
  `emails.send`), and `reply_to` must be a valid address.

- Docs: `automations.activate` lists the two cloud-only `no_verified_sender`
  reasons, `CUSTOM_DOMAIN_REQUIRED` and the new `BUILT_IN_SENDER` (a step sends
  from the built-in `{slug}.mailtea.email` address). No runtime change.
- Changed: `domains.list({ region })` accepts any string as well as the catalog
  regions, because the API now also accepts the deployment's default region,
  which a domain with no stored region reports (for example `us-east-1` in local
  development or on a self-hosted install). Type-only; no runtime change.
- Docs: the `assets` resource no longer says SVG is refused. It is accepted and
  served under a sandboxing Content-Security-Policy; use PNG or JPEG for email,
  because Gmail and Outlook do not show SVG.
- Breaking: `posts.create` with `template_id` now HTML-escapes the `variables`
  you pass, the same as every other send. HTML passed in a `{{key}}` value now
  arrives as visible text, and a value you escaped yourself arrives
  double-escaped. Put `{{{key}}}` in the template where a value is meant to be
  raw HTML. Variables are now filled in both the `{{key}}` and Visual Email
  Designer `{key}` forms. A declared variable you do not pass stays in the
  post with its `fallback_value`, so the broadcast gives each recipient their
  own value or that fallback, and undeclared tokens like
  `{{contact.first_name}}` are left for the broadcast too. The post keeps the
  template's published page style, is wrapped in that page, and has its
  show-if blocks decided per recipient when it is sent. Before, only the
  variables you passed were replaced, raw, and only in `{{key}}` form. It uses
  the template's published version; Mailtea Studio's "Use template" starts
  from the latest saved design instead.
- Changed: `templates.update` and `templates.restoreVersion` no longer move a
  published template back to draft. The template keeps its published status,
  and automations and the API keep sending its published version until
  `templates.publish` is called again. The template's `from` and `reply_to`
  are part of the published version too, so a new sender or reply-to address
  reaches sends only after the next publish. `templates.unpublish` is now the
  only way to stop a published template sending, short of deleting it, and it
  drops the stored published version so the next publish starts from the
  current content.
- Added: `has_unpublished_versions` on `Template` and `TemplateListItem`. True
  only when the template is published and its saved content (From, Reply-To
  and the style profile included) differs from the published version.
- Added: `TemplateVersion.is_published`: true for the one entry automations
  and the API are sending now. `is_current` is now described as what it is:
  the entry that matches the working copy (the saved design being edited), not
  necessarily what is sending. `is_published` is false on every entry of a
  draft, and on a template published before the field existed until it is
  published again.
- Changed: `templates.update` returns `UpdatedTemplate`: the template plus the
  PATCH reply's `unpublished` and, when the edit is not live yet, `message`.
- Changed: `RestoredTemplateVersion.unpublished` and the PATCH reply's
  `unpublished` are kept for compatibility and are now always `false`. Check
  `has_unpublished_versions` (or the reply's `message`) instead.
- Changed (API behavior): a template variable's `fallback_value` can no longer
  contain `{` or `}`. Creating a template with one, or changing a fallback
  to one on update, is a 400 ("Fallbacks can't contain { or }."). A value
  the template already stores is accepted unchanged, so a template saved
  before the rule keeps saving. Inline chip fallbacks such as
  `{first_name|Mom & Pop}` now render as written instead of double-escaped.
- Added: `AutomationValidationIssue.pre_existing`, set by the API when the
  version the automation last ran on already had the same problem (same code,
  step and path).
- Changed (API behavior): saving an active automation is refused only when the
  edit adds an error the live version does not already have. The 422
  `active_graph_invalid` reply's `issues` lists just those new problems.
  Before, any error refused the save, even one the live version already had.
  Starting refuses every error as before, except an `unknown_step_ref` at a
  `config.*` path or a trigger `missing_branch` that the version the
  automation last ran on already had, so pausing and starting an unchanged
  automation keeps working. Issues the last live version already had come back
  with `pre_existing: true`.
- Added: `AutomationValidationIssue.field`, what a rule reads (the rule's
  `field`, or the path in a `{"var": ...}` value, e.g.
  `steps.welcome.opened`) when the issue is about one.
- Changed (API behavior): two issues are the same problem when their code and
  step match, and their `field` or, when there is none, their `path`. Moving
  a rule, by removing a rule beside it or putting it in a group, no longer
  makes a problem the live version already had look new. An error is
  `pre_existing` only if the live version had an error there, not a warning.
- Changed (API behavior): `validate_only` on an active automation answers the
  way the save would. A trigger change is a 422 `trigger_locked_while_active`,
  a change that adds a problem is a 422 `active_graph_invalid` listing only
  the new problems, and otherwise issues come back with `pre_existing` marked
  against the version live now. Before, it returned every issue unmarked.
- Changed (API behavior): changing the trigger (its type or key) of an active
  automation is now refused with 422 `trigger_locked_while_active`. Pause it
  first; draft and paused automations can still change their trigger. Before,
  the change was accepted.
- Added (API behavior): new validation rules. A trigger with nothing after it
  is a `missing_branch` error at `branches.next`. A rule or `{"var": ...}`
  value that reads `steps.<key>.*` for a step that isn't in the automation is
  an `unknown_step_ref` error at that `config.*` path, or a warning when the
  `{"var": ...}` has a `default`. A rule or value that reads
  `event.properties.*` when the automation does not start from an app event is
  the new warning `event_field_without_event_trigger`.
- Changed: `SendEmailInput.subject` is optional when you send a `template`,
  and `from` / `sender_id` may both be left out with one. The API then uses
  the template's published subject, and its sender is chosen the way an
  automation step chooses one (the publication's default sender, then the
  template's own From). Without a template both are still required. Batch
  items are unchanged: `BatchEmailItemInput` still requires `from` and
  `subject`.
- Behaviour (API, no SDK change needed): a template send now fills the
  template's variables into the subject with the same values and fallbacks as
  the body. A template built in the Visual Email Designer is delivered inside
  its designed page background, card and font. Raw HTML templates are sent
  exactly as stored.

## 0.15.0 (2026-09-15)

- Added: test mode. `apiKeys.create({ mode: "test" })` mints a test key
  (prefixed `mt_test_`) whose sends are validated, recorded and webhook-emitting
  but never delivered, so CI can run against production Mailtea with your real
  code and your real webhook handler. A test key is **not** a data sandbox — it
  reads and writes your real contacts, templates, senders and webhooks. Only
  delivery is simulated.
- Added: `mode` on `ListEmailsParams`, so `emails.list({ mode: "test" })` reads
  test-mode mail. There is no mixed view: a test key reads only test emails and
  a live key only live ones, and asking for the mode your key is not in is a 400
  rather than an empty page.
- Added: `mode` on `EmailListItem`, `RetrievedEmail`, `CreatedApiKey` and
  `ApiKeyListItem`, plus the `EmailMode` type — an open union like
  `EmailStatus`, so a value added server-side still types.
- Note: `mode` is never accepted on a send. The key decides.
- Reserved recipients on `test.mailtea.email` force an outcome: `delivered@`,
  `bounced@`, `complained@`, `delayed@`, `failed@`. The first `to` recipient
  decides; anything else is delivered.
- Added: `MailteaError.reason` — the API's second machine-readable
  discriminator, alongside `code`. Several routes answer with `reason` and no
  `code` (`mode_not_available`, `test_recipient_in_live_mode`,
  `test_mode_daily_cap`), and it was being dropped when the response was
  parsed, leaving those callers to string-match the message.

## 0.14.0 (2026-09-10)

- Added: `receiving_identity_status` on domain responses (create, get, update,
  verify). `pending`, `verified`, `failed`, or `null` when the domain is not
  registered to receive mail yet. Point an `MX` at Mailtea only once it reads
  `verified`; it never gates `status`.
- Changed: `automations.activate` documents the `no_verified_sender` refusal.
  A 422 with that code means a `send_email` step has no sender it can send
  from; `reason` (`NO_SENDER`, `DOMAIN_NOT_VERIFIED`, `WRONG_PURPOSE`,
  `DKIM_NOT_VERIFIED` or `INVALID_FROM`) says which, and `steps[]` names every
  blocking step. Previously only `automation_invalid` was documented.
- Added: `domains.update` takes `tracking_subdomain: null` to remove a tracking
  subdomain. The domain's links go back to being served from the Mailtea host.
  Links in mail you have already sent point at the old hostname and stop
  resolving — there is no way to reinstate them. An empty string is not the same
  thing: it is refused with `tracking_subdomain_invalid`. `null` is accepted on
  update only; `CreateDomainInput.tracking_subdomain` stays a `string`.
- Changed: the `MX` row in `records` now reports what the last verify found,
  instead of reading `pending` on every request but the verify itself. A domain
  nobody has verified reads `not_started`.

## 0.13.0 (2026-09-03)

- Added: `mailtea.domains.claims` — `create`, `get`, `verify` and `cancel`. When
  adding a domain is refused with code `domain_held_elsewhere`, another
  publication holds the host; publish one TXT record to prove you control its
  DNS and the domain moves to you. Verifying before the record has propagated
  is safe: the claim stays pending with the same record.
- Added: `Domain` carries `region`, `tls`, `tracking_subdomain` and
  `released_at`. A domain's region decides where its mail is sent from and is
  fixed at creation; `tls: "enforced"` bounces rather than delivering in the
  clear; a tracking subdomain serves opens and clicks from your own domain;
  `released_at` is set when another publication claimed the host, and a
  released domain cannot send whatever its `status` says.
- Added: `domains.create` takes `region`, `tls` and `tracking_subdomain`;
  `domains.update` takes the two that are mutable; `domains.list` takes `region`
  and `status` filters.
- Added: `DomainRefusalCode` is exported, so a refusal is matched on `code`
  rather than on prose.
- Added: `TrackingDomain.attached` — whether the host is registered on our edge,
  which is what makes a certificate exist for it. A verified CNAME with
  `attached: false` means links are still served from the platform host.
- Changed: each row in `records` now says what it is FOR in `record`
  (`Ownership`, `DKIM`, `SPF`, `MX`, `Return-Path`, `Tracking`), carries
  `ttl: "Auto"`, and reports its OWN status rather than the domain's — including
  `not_started` where nothing has checked the record yet. `type` still holds the
  DNS type and `purpose` is unchanged.
- Added: `contacts.setPropertyValues(contactId, { publication_id, values })` and
  `contacts.listPropertyValues(contactId, { publication_id })`. These write and
  read the per-contact values behind `{{contact.<key>}}` merge tags. Defining a
  property only created the field — until now there was no way from the SDK to
  put a value on a contact, so a script could define `first_name` and never set
  it. Each entry takes either `property_id` or `key` (not both); an empty
  `value` clears the property, and its `fallback_value` applies again.

## 0.12.0 (2026-08-27)

- Added: `baseUrl` falls back to the `MAILTEA_API_BASE_URL` environment
  variable before defaulting to `https://api.mailtea.app`. Point a self-hosted
  or local instance at the SDK without threading an option through your code.
  An explicit `baseUrl` still wins. This closes a gap the other clients did not
  have — the Python SDK, the CLI and the MCP server have always read it.
- Fixed: the global `fetch` is now bound before it is stored, so the SDK works
  on Cloudflare Workers without a wrapper. The stored reference is called bare,
  which strips the global `this`; Node and browsers tolerate that, the Workers
  runtime answers `TypeError: Illegal invocation`. Workers users no longer need
  to pass `fetch: globalThis.fetch.bind(globalThis)`. A `fetch` you supply is
  still used exactly as given.

## 0.11.0 (2026-08-25)

- Documented: the API now enforces your plan's analytics retention window on
  `from_date`. It is clamped to 30 days on most plans and 90 on Scale and
  Enterprise; a value reaching further back returns data from the start of that
  window rather than an error, and omitting it returns the window rather than
  all time.
- **BREAKING (types only) — `EmailAnalytics.from_date` is now `string`, not
  `string | null`.** The server always reports the window it used, so the field
  can no longer be null. Under `strictNullChecks` a null comparison against it
  is now a compile error; delete the null branch. No runtime behaviour changes,
  and reading the field is unaffected.
- Added: `EmailListResponse.from_date` — the list response now reports the
  window used, the same way analytics does. That is how a clamped request stays
  visible rather than silently returning less.
- Changed: `EmailListParams.from_date`, `EmailAnalyticsParams.from_date` and
  `EmailAnalytics.from_date` carry it in their doc comments.

## 0.10.0 (2026-08-24)

- Changed: every transactional webhook's `to` is the envelope the message was
  actually delivered to, and a new `dropped_recipients` names anyone filtered
  out (suppressed, or an address that could not be used). `dropped_recipients`
  is also on the email record. If you reconcile deliveries from webhooks, read
  `to` rather than the recipients you submitted — a partially-suppressed send
  used to report a delivery that never happened.

- Added: `domains.update` accepts `custom_return_path`, and every domain shape
  carries `custom_return_path` / `custom_return_path_status`. Delegating a
  subdomain as the envelope sender makes SPF align with your own domain instead
  of ours, and routes bounces somewhere you can see. Mail keeps sending on the
  default return-path until the delegated DNS resolves.

- Changed: `to`, `cc` and `bcc` are validated as email addresses. A malformed
  recipient now returns `400` instead of being accepted and failing at the
  provider. The `"Name" <address>` form keeps working; an explicitly empty `cc`
  or `bcc` still means "no cc".

- Added: `domains.list` and `domains.get` return `open_tracking` /
  `click_tracking`, and `domains.update` accepts them — the sending domain's
  tracking policy is now readable and settable from the SDK.

- Added: `tracking_open` and `tracking_click` on `emails.send` and
  `emails.batch` — send a message without an open pixel or without rewritten
  links. A sending domain that has tracking switched off cannot be overridden
  from a send, so code that does not know about the policy cannot break it.

## 0.9.0 (2026-08-22)

- Changed: `emails.analytics` reports `open_rate` and `click_rate` against
  delivered mail (`sent - bounced`) rather than everything sent. A bounced email
  was never open-able, so counting it understated engagement — this is how the
  figures read in Mailtea Studio and how email platforms report them generally.
  Both rates will read higher than before for the same data. `delivery_rate` and
  `bounce_rate` are unchanged, still measured against `sent`, and every
  underlying count is still in the response if you want the previous figure.

- Added: `emails.get` returns `error` and `failed_at`. A failed send now says why
  over the API, not only in Mailtea Studio. The wording is neutral — the delivery
  provider's own message is never relayed — so it is safe to show to your users.

- Added: `image/svg+xml` is an accepted asset type for `assets.upload` — SVG
  logos and marks upload like any raster. The public asset route serves every
  asset with `Content-Security-Policy: sandbox`, which is what makes hosting
  SVGs safe: scripts inside one never execute, in an `<img>` or navigated to
  directly.


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
