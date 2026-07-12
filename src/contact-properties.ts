import type { RequestFn, ListResponse, DeletedResponse } from "./resource.js";
import { query } from "./resource.js";

export type ContactPropertyType = "string" | "number";

export interface ContactProperty {
  object: "contact_property";
  id: string;
  key: string;
  type: ContactPropertyType;
  fallback_value: string | null;
  description: string;
  created_at: string;
}

export interface CreateContactPropertyInput {
  key: string;
  type: ContactPropertyType;
  fallback_value?: string | number;
  description?: string;
}

export interface UpdateContactPropertyInput {
  /** Pass `null` to clear the fallback. */
  fallback_value?: string | number | null;
  description?: string;
}

export interface ListContactPropertiesParams {
  limit?: number;
  after?: string;
}

/**
 * The `contactProperties` resource (custom contact fields). Access via
 * `mailtea.contactProperties`. Definitions are team-scoped — no
 * `publication_id`.
 */
export class ContactProperties {
  constructor(private readonly request: RequestFn) {}

  /** Define a custom contact property. */
  create(input: CreateContactPropertyInput): Promise<ContactProperty> {
    return this.request<ContactProperty>("POST", "/v1/contact-properties", input);
  }

  /** List the team's custom contact property definitions. */
  list(
    params: ListContactPropertiesParams = {}
  ): Promise<ListResponse<ContactProperty>> {
    return this.request<ListResponse<ContactProperty>>(
      "GET",
      `/v1/contact-properties${query({ ...params })}`
    );
  }

  /** Update a property's fallback value or description. */
  update(
    id: string,
    input: UpdateContactPropertyInput
  ): Promise<ContactProperty> {
    return this.request<ContactProperty>(
      "PATCH",
      `/v1/contact-properties/${encodeURIComponent(id)}`,
      input
    );
  }

  /** Delete a custom contact property. */
  delete(id: string): Promise<DeletedResponse> {
    return this.request<DeletedResponse>(
      "DELETE",
      `/v1/contact-properties/${encodeURIComponent(id)}`
    );
  }
}
