import type { RequestFn, ListResponse, DeletedResponse } from "./resource.js";
import { query } from "./resource.js";

/** The jsonb type vocabulary, shared by inferred types and declared schemas. */
export type EventPropertyType = "string" | "number" | "boolean" | "object" | "array" | "null";

/** One declared property in an event definition's `schema_json`. */
export interface EventSchemaProperty {
  /** One type or a list of them. Absent means "any type". */
  type?: EventPropertyType | EventPropertyType[];
  required?: boolean;
  description?: string;
}

/** The optional schema attachable to an event definition. Deliberately tiny —
 *  a `{type, required}` map, not JSON Schema. */
export interface EventSchemaDocument {
  properties: Record<string, EventSchemaProperty>;
  /** Defaults to `true`: a schema documents what it knows without closing the payload. */
  additional_properties?: boolean;
}

/** A row in the queryable event log. Named `MailteaEvent` because `Event` is a
 *  DOM global. */
export interface MailteaEvent {
  object: "event";
  id: string;
  publication_id: string;
  name: string;
  contact_id: string;
  properties: Record<string, unknown>;
  idempotency_key: string | null;
  occurred_at: string;
  created_at: string;
}

/** The 202 answer to `events.send`. The fan-out counts let a caller verify the
 *  event did something without polling — but `resumed_runs: 0` does NOT prove
 *  nothing matched, since a run being advanced concurrently is invisible to the
 *  matching query for that instant. Read the run, not the counter. */
export interface EventIngestResult {
  object: "event";
  id: string;
  name: string;
  contact_id: string;
  created_at: string;
  enrolled_automations: number;
  resumed_runs: number;
  /** Present only on an idempotent replay, which returns the ORIGINAL event id
   *  and always reports both counts as `0`. */
  replayed?: true;
}

/** Send a custom event. Provide exactly one of `contact_id` or `email`. */
export interface SendEventInput {
  publication_id: string;
  /** `^[a-z0-9][a-z0-9._-]{0,63}$`. */
  name: string;
  contact_id?: string;
  email?: string;
  /** Opt-in. Without it an unresolvable `email` is a 404 `contact_not_found`. */
  create_contact?: boolean;
  /** Max 32 KB serialized, max 8 levels deep. `__proto__` is refused anywhere. */
  properties?: Record<string, unknown>;
  /** Caller metadata. Never drives scheduling. */
  occurred_at?: string;
  idempotency_key?: string;
}

export interface ListEventsParams {
  publication_id: string;
  name?: string;
  contact_id?: string;
  limit?: number;
  after?: string;
}

export interface EventDefinition {
  object: "event_definition";
  id: string;
  publication_id: string;
  name: string;
  description: string | null;
  schema_json: EventSchemaDocument | null;
  /** How the definition came to exist, e.g. declared by an operator or seen on ingest. */
  source: string;
  created_at: string;
  updated_at: string;
}

/** One property a schema declares. */
export interface EventSchemaPropertyView {
  key: string;
  /** Empty when the schema declares the key without a type. */
  types: EventPropertyType[];
  required: boolean;
  description: string | null;
}

/** One property observed in the sampled events. */
export interface InferredEventProperty {
  key: string;
  /** More than one entry means two producers disagree about the payload shape. */
  types: EventPropertyType[];
  sample_count: number;
  /** `sample_count / inferred_from_samples`, 4 decimal places. The trap: a
   *  condition on a key present in 3 % of events almost never matches. */
  coverage: number;
}

/** `eventDefinitions.get` adds the declared and observed property views. */
export interface EventDefinitionDetail extends EventDefinition {
  /** Authoritative when a schema is declared. */
  schema_properties: EventSchemaPropertyView[];
  /** Computed on read over the most recent events — returned alongside
   *  `schema_properties` so an operator can spot drift. */
  inferred_properties: InferredEventProperty[];
  /** The denominator of every `coverage`. */
  inferred_from_samples: number;
  /** The size of the window inference samples. */
  inference_sample_size: number;
}

export interface CreateEventDefinitionInput {
  publication_id: string;
  name: string;
  description?: string;
  schema_json?: EventSchemaDocument;
}

/** Update a definition. `name` is immutable (sending it is a 400
 *  `event_name_immutable`); `schema_json: null` clears the schema back to
 *  free-form. `publication_id` is sent in the query string. */
export interface UpdateEventDefinitionInput {
  publication_id: string;
  description?: string;
  schema_json?: EventSchemaDocument | null;
}

export interface ListEventDefinitionsParams {
  publication_id: string;
  limit?: number;
  after?: string;
}

/**
 * The `events` resource (custom events that trigger automations and resume
 * `wait_for_event` steps). Access via `mailtea.events`.
 */
export class Events {
  constructor(private readonly request: RequestFn) {}

  /** Record an event. Returns 202 with the enrollment/resume fan-out counts. */
  send(input: SendEventInput): Promise<EventIngestResult> {
    return this.request<EventIngestResult>("POST", "/v1/events", input);
  }

  /** Query the event log, newest first. */
  list(params: ListEventsParams): Promise<ListResponse<MailteaEvent>> {
    return this.request<ListResponse<MailteaEvent>>("GET", `/v1/events${query({ ...params })}`);
  }
}

/**
 * The `event definitions` resource (documented event names, with an optional
 * property schema). Access via `mailtea.eventDefinitions`.
 */
export class EventDefinitions {
  constructor(private readonly request: RequestFn) {}

  /** Declare an event name. */
  create(input: CreateEventDefinitionInput): Promise<EventDefinition> {
    return this.request<EventDefinition>("POST", "/v1/event-definitions", input);
  }

  /** List event definitions (property views omitted). */
  list(params: ListEventDefinitionsParams): Promise<ListResponse<EventDefinition>> {
    return this.request<ListResponse<EventDefinition>>(
      "GET",
      `/v1/event-definitions${query({ ...params })}`
    );
  }

  /** Retrieve a definition with its declared and inferred property views. */
  get(id: string, params: { publication_id: string }): Promise<EventDefinitionDetail> {
    return this.request<EventDefinitionDetail>(
      "GET",
      `/v1/event-definitions/${encodeURIComponent(id)}${query({ ...params })}`
    );
  }

  /** Update a definition's description or schema. */
  update(id: string, input: UpdateEventDefinitionInput): Promise<EventDefinition> {
    // The event-definitions API reads publication_id from the query string, and
    // its update schema has no such field — so it is stripped from the body.
    const { publication_id, ...body } = input;
    return this.request<EventDefinition>(
      "PATCH",
      `/v1/event-definitions/${encodeURIComponent(id)}${query({ publication_id })}`,
      body
    );
  }

  /** Delete a definition. The events themselves are untouched. */
  delete(id: string, params: { publication_id: string }): Promise<DeletedResponse> {
    return this.request<DeletedResponse>(
      "DELETE",
      `/v1/event-definitions/${encodeURIComponent(id)}${query({ ...params })}`
    );
  }
}
