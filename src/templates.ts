import type { RequestFn, ListResponse, DeletedResponse } from "./resource.js";
import { query } from "./resource.js";

export type TemplateStatus = "draft" | "published";
export type TemplateFormat = "html" | "spec" | "editor";
export type TemplateVariableType = "string" | "number";

export interface TemplateVariable {
  key: string;
  type: TemplateVariableType;
  fallback_value?: string | number;
}

/** A single element in a json-render `spec`. */
export interface TemplateSpecElement {
  type: string;
  props?: Record<string, unknown>;
  children?: string[];
  visible?: unknown;
}

/** A json-render `spec`: a root element id plus the element map it references. */
export interface TemplateSpec {
  root: string;
  elements: Record<string, TemplateSpecElement>;
}

/** The design source behind `format: "editor"` — a TipTap/ProseMirror document.
 *  Left open because the node set depends on which editor extensions are in
 *  play; the server is what validates it and bakes the `html` from it. */
export interface EditorDocument {
  type: "doc";
  content: unknown[];
  [key: string]: unknown;
}

export interface Template {
  object: "template";
  id: string;
  publication_id: string;
  name: string;
  description: string;
  html: string;
  spec: TemplateSpec | null;
  /** Null on every `html` and `spec` template — only editor designs carry it. */
  editor_doc: EditorDocument | null;
  style_profile: Record<string, unknown> | null;
  mailtea_theme: Record<string, unknown> | null;
  global_css: string | null;
  category: string | null;
  preview_image_url: string | null;
  tags: string[];
  format: TemplateFormat;
  text: string | null;
  subject: string | null;
  from: string | null;
  reply_to: string | null;
  variables: TemplateVariable[];
  status: TemplateStatus;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

/** A row returned by `templates.list` — omits the body fields (`html`, `spec`,
 *  `editor_doc`, its style sidecars, `text`, `subject`, `from`, `reply_to`,
 *  `variables`). The library metadata stays: it is what a gallery renders. */
export interface TemplateListItem {
  object: "template";
  id: string;
  publication_id: string;
  name: string;
  description: string;
  category: string | null;
  preview_image_url: string | null;
  tags: string[];
  format: TemplateFormat;
  status: TemplateStatus;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface RenderTemplateInput {
  spec: TemplateSpec;
  variables?: Record<string, string | number>;
}

export interface RenderedTemplate {
  html: string;
  text: string;
}

/** Create a template. Provide exactly one content source: `html`, `spec` or
 *  `editor_doc`. The editor path is server-rendered — the API bakes the `html`
 *  from the doc, so sending your own alongside it is rejected. */
export interface CreateTemplateInput {
  publication_id: string;
  name: string;
  html?: string;
  spec?: TemplateSpec;
  editor_doc?: EditorDocument;
  style_profile?: Record<string, unknown>;
  mailtea_theme?: Record<string, unknown>;
  global_css?: string;
  category?: string;
  preview_image_url?: string;
  tags?: string[];
  description?: string;
  text?: string;
  subject?: string;
  from?: string;
  reply_to?: string;
  variables?: TemplateVariable[];
}

/** Update a template. `text`/`subject`/`from`/`reply_to`/`global_css`/
 *  `category`/`preview_image_url`/`tags` are nullable (pass `null` to clear).
 *  `publication_id` is required (sent in the query string). */
export interface UpdateTemplateInput {
  publication_id: string;
  name?: string;
  html?: string;
  spec?: TemplateSpec;
  editor_doc?: EditorDocument;
  style_profile?: Record<string, unknown>;
  mailtea_theme?: Record<string, unknown>;
  global_css?: string | null;
  category?: string | null;
  preview_image_url?: string | null;
  tags?: string[] | null;
  description?: string;
  text?: string | null;
  subject?: string | null;
  from?: string | null;
  reply_to?: string | null;
  variables?: TemplateVariable[];
}

export interface ListTemplatesParams {
  publication_id: string;
  limit?: number;
  after?: string;
}

/** What an entry in a template's history IS, in one word. `edit` is a content
 *  save, `publish` the state captured at a publish, `restore` a design put back
 *  from an earlier entry. */
export type TemplateVersionOrigin = "edit" | "publish" | "restore";

/** Who wrote a version. `null` when the author can no longer be resolved. */
export interface TemplateVersionAuthor {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
}

/** One entry in a template's history. Metadata only — the design itself is
 *  never returned, because a single version can carry half a megabyte of
 *  document and the list is a column of timestamps. */
export interface TemplateVersion {
  id: string;
  version: number;
  origin: TemplateVersionOrigin;
  /** The version this entry was restored FROM. Null unless `origin` is
   *  `"restore"`. */
  restored_from_version: number | null;
  format: TemplateFormat;
  name: string;
  /** Closed to further coalescing — no later edit can fold into it. */
  sealed: boolean;
  /** The entry whose design is the template's live content. NOT necessarily the
   *  newest: a metadata-only update bumps the template without writing a
   *  version, so `is_current` is the comparison, not the position. */
  is_current: boolean;
  created_at: string;
  updated_at: string;
  author: TemplateVersionAuthor | null;
}

/** The two retention rules, reported so a caller can explain a version that is
 *  missing rather than guess. */
export interface TemplateVersionRetention {
  /** Newest-N kept per template; older entries are pruned. */
  max_versions: number;
  /** Consecutive edits by the same author inside this window collapse into a
   *  single version. */
  coalesce_window_seconds: number;
}

/** The `templates.listVersions` response. Deliberately not the standard list
 *  envelope: history is capped rather than paginated, so there is no cursor —
 *  `retention` says what the cap is. */
export interface TemplateVersionList {
  object: "list";
  data: TemplateVersion[];
  retention: TemplateVersionRetention;
}

export interface ListTemplateVersionsParams {
  publication_id: string;
  /** Newest N entries. The server caps this at the full retained history (50). */
  limit?: number;
}

/** The answer to a restore. */
export interface RestoredTemplateVersion {
  /** False when the requested version is already the current design — nothing
   *  was written, and the template's `status` is untouched. */
  restored: boolean;
  /** Why nothing was written. Only present when `restored` is false. */
  reason?: "identical";
  /** Which version supplied the design. Absent on a no-op. */
  restored_from_version?: number;
  /** Whether this call took the template out of circulation. See
   *  {@link Templates.restoreVersion} — a restore is a content write, so it
   *  returns a published template to `draft` and sends STOP until it is
   *  published again. */
  unpublished: boolean;
  /** Human-readable summary of what happened, safe to surface verbatim. */
  message: string;
  /** The template as it stands after the call. */
  template: Template;
}

/**
 * The `templates` resource (stored email templates). Access via
 * `mailtea.templates`.
 */
export class Templates {
  constructor(private readonly request: RequestFn) {}

  /** Render a `spec` to HTML/text without creating a template. */
  render(input: RenderTemplateInput): Promise<RenderedTemplate> {
    return this.request<RenderedTemplate>("POST", "/v1/templates/render", input);
  }

  /** Create a template from `html`, a `spec`, or an `editor_doc`. */
  create(input: CreateTemplateInput): Promise<Template> {
    return this.request<Template>("POST", "/v1/templates", input);
  }

  /** List templates in a publication (body fields omitted). */
  list(params: ListTemplatesParams): Promise<ListResponse<TemplateListItem>> {
    return this.request<ListResponse<TemplateListItem>>(
      "GET",
      `/v1/templates${query({ ...params })}`
    );
  }

  /** Retrieve a single template, including its body. */
  get(id: string, params: { publication_id: string }): Promise<Template> {
    return this.request<Template>(
      "GET",
      `/v1/templates/${encodeURIComponent(id)}${query({ ...params })}`
    );
  }

  /** Update a template. */
  update(id: string, input: UpdateTemplateInput): Promise<Template> {
    // The templates API reads publication_id from the query string; the rest of
    // the fields go in the body.
    return this.request<Template>(
      "PATCH",
      `/v1/templates/${encodeURIComponent(id)}${query({ publication_id: input.publication_id })}`,
      input
    );
  }

  /** Publish a template (its `status` becomes `published`). */
  publish(id: string, params: { publication_id: string }): Promise<Template> {
    return this.request<Template>(
      "POST",
      `/v1/templates/${encodeURIComponent(id)}/publish${query({ ...params })}`
    );
  }

  /** Return a published template to draft. `published_at` is kept — it records
   *  that the template was published once, not that it still is. */
  unpublish(id: string, params: { publication_id: string }): Promise<Template> {
    return this.request<Template>(
      "POST",
      `/v1/templates/${encodeURIComponent(id)}/unpublish${query({ ...params })}`
    );
  }

  /** Duplicate a template into a new draft. */
  duplicate(id: string, params: { publication_id: string }): Promise<Template> {
    return this.request<Template>(
      "POST",
      `/v1/templates/${encodeURIComponent(id)}/duplicate${query({ ...params })}`
    );
  }

  /** Delete a template. */
  delete(
    id: string,
    params: { publication_id: string }
  ): Promise<DeletedResponse> {
    return this.request<DeletedResponse>(
      "DELETE",
      `/v1/templates/${encodeURIComponent(id)}${query({ ...params })}`
    );
  }

  /** List a template's version history, newest first (metadata only — no
   *  designs). Only the newest 50 versions are kept, and consecutive edits by
   *  the same author within 10 minutes collapse into one entry; `retention` on
   *  the response carries both numbers. */
  listVersions(
    id: string,
    params: ListTemplateVersionsParams
  ): Promise<TemplateVersionList> {
    return this.request<TemplateVersionList>(
      "GET",
      `/v1/templates/${encodeURIComponent(id)}/versions${query({ ...params })}`
    );
  }

  /** Put an earlier design back.
   *
   *  **A restore returns the template to `draft`.** It is a content write, so
   *  automations and the API STOP sending this template until it is published
   *  again; `unpublished` on the response reports whether that actually
   *  happened, so a caller that reads nothing else still learns its own call
   *  stopped the sends.
   *
   *  History is forward-only — a restore does not rewind. It records the state
   *  it replaced as its own version and then adds the restored design as a new
   *  version, so a restore can itself be undone by restoring the entry above
   *  the one you restored.
   *
   *  Restoring the design that is already current writes nothing and comes back
   *  `restored: false`, `reason: "identical"` — the template keeps sending. */
  restoreVersion(
    id: string,
    version: number,
    params: { publication_id: string }
  ): Promise<RestoredTemplateVersion> {
    return this.request<RestoredTemplateVersion>(
      "POST",
      `/v1/templates/${encodeURIComponent(id)}/versions/${encodeURIComponent(version)}/restore${query({ ...params })}`
    );
  }
}
