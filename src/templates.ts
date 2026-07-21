import type { RequestFn, ListResponse, DeletedResponse } from "./resource.js";
import { query } from "./resource.js";

export type TemplateStatus = "draft" | "published";
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

export interface Template {
  object: "template";
  id: string;
  publication_id: string;
  name: string;
  description: string;
  html: string;
  spec: TemplateSpec | null;
  format: string;
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
 *  `text`, `subject`, `from`, `reply_to`, `variables`). */
export interface TemplateListItem {
  object: "template";
  id: string;
  publication_id: string;
  name: string;
  description: string;
  format: string;
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

/** Create a template. Provide either `html` or `spec` (not both). */
export interface CreateTemplateInput {
  publication_id: string;
  name: string;
  html?: string;
  spec?: TemplateSpec;
  description?: string;
  text?: string;
  subject?: string;
  from?: string;
  reply_to?: string;
  variables?: TemplateVariable[];
}

/** Update a template. `text`/`subject`/`from`/`reply_to` are nullable (pass
 *  `null` to clear). `publication_id` is required (sent in the query string). */
export interface UpdateTemplateInput {
  publication_id: string;
  name?: string;
  html?: string;
  spec?: TemplateSpec;
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

  /** Create a template from `html` or a `spec`. */
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
}
