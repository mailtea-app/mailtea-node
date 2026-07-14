import type { RequestFn, ListResponse, DeletedResponse } from "./resource.js";
import { query } from "./resource.js";

export type ContactStatus = "active" | "unsubscribed" | "suppressed";

export interface Contact {
  object: "contact";
  id: string;
  publication_id: string;
  email: string;
  status: ContactStatus;
  created_at: string;
  updated_at: string;
}

export interface CreateContactInput {
  publication_id: string;
  email: string;
  status?: ContactStatus;
}

export interface UpdateContactInput {
  publication_id: string;
  status?: ContactStatus;
}

export interface ListContactsParams {
  publication_id: string;
  limit?: number;
  after?: string;
  status?: ContactStatus;
  search?: string;
}

/** The `contacts` resource. Access via `mailtea.contacts`. */
export class Contacts {
  constructor(private readonly request: RequestFn) {}

  /** Create (or upsert) a contact in a publication. */
  create(input: CreateContactInput): Promise<Contact> {
    return this.request<Contact>("POST", "/v1/contacts", input);
  }

  /**
   * Create the contact or update it in place — alias of `create`, named for
   * what `POST /v1/contacts` actually does.
   */
  upsert(input: CreateContactInput): Promise<Contact> {
    return this.create(input);
  }

  /** List contacts in a publication. Supports cursor pagination via `after`. */
  list(params: ListContactsParams): Promise<ListResponse<Contact>> {
    return this.request<ListResponse<Contact>>(
      "GET",
      `/v1/contacts${query({ ...params })}`
    );
  }

  /** Retrieve a single contact by id or email. */
  get(idOrEmail: string, params: { publication_id: string }): Promise<Contact> {
    return this.request<Contact>(
      "GET",
      `/v1/contacts/${encodeURIComponent(idOrEmail)}${query({ ...params })}`
    );
  }

  /** Update a contact's status. */
  update(idOrEmail: string, input: UpdateContactInput): Promise<Contact> {
    // publication_id is sent in the body (the API reads it there) and in the
    // query for parity with the other audience resources.
    return this.request<Contact>(
      "PATCH",
      `/v1/contacts/${encodeURIComponent(idOrEmail)}${query({ publication_id: input.publication_id })}`,
      input
    );
  }

  /** Delete a contact by id or email. */
  delete(
    idOrEmail: string,
    params: { publication_id: string }
  ): Promise<DeletedResponse> {
    return this.request<DeletedResponse>(
      "DELETE",
      `/v1/contacts/${encodeURIComponent(idOrEmail)}${query({ ...params })}`
    );
  }
}
