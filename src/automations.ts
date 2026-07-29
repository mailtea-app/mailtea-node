import type { RequestFn, ListResponse, DeletedResponse } from "./resource.js";
import type { AutomationRunStatus } from "./automation-runs.js";
import { query } from "./resource.js";

export type AutomationStatus = "draft" | "active" | "paused" | "archived";

export type AutomationTriggerType =
  | "contact.created"
  | "contact.subscribed"
  | "contact.unsubscribed"
  | "tag.subscribed"
  | "tag.unsubscribed"
  | "event"
  | "email.opened"
  | "email.clicked"
  | "email.received";

export type AutomationStepType =
  | "trigger"
  | "delay"
  | "condition"
  | "wait_for_event"
  | "send_email"
  | "tag_add"
  | "tag_remove"
  | "segment_add"
  | "segment_remove"
  | "contact_update"
  | "http_request"
  | "exit";

/** Branch labels a step may emit. `condition` emits `condition_met`/
 *  `condition_not_met`, `wait_for_event` emits `event_received`/`timeout`,
 *  every other step emits `next`, and `exit` is terminal. */
export type AutomationBranch =
  | "next"
  | "condition_met"
  | "condition_not_met"
  | "event_received"
  | "timeout";

/** `once_per_window` requires `reentry_window_seconds`; the other two reject it. */
export type AutomationReentryPolicy = "once" | "once_per_window" | "always";

/** What a failing step does to the run: end it, or carry on down `next`. */
export type AutomationStepFailureMode = "fail" | "continue";

export type AutomationValidationSeverity = "error" | "warning";

/** A coded, path-addressed problem with a graph. Only `error` severity blocks
 *  activation — warnings ride along informationally. */
export interface AutomationValidationIssue {
  /** Stable machine code, e.g. `missing_trigger` or `delay_out_of_range`. */
  code: string;
  severity: AutomationValidationSeverity;
  /** The offending step, when the issue is step-scoped. */
  step_key?: string;
  /** Dotted/indexed location, e.g. `connections[2].to` or `config.duration`. */
  path?: string;
  message: string;
}

export interface AutomationStep {
  /** Graph-local identity, `^[a-z0-9_-]{1,64}$`. It is the join key for step
   *  runs and per-step metrics, so renaming one orphans that step's history. */
  key: string;
  type: AutomationStepType;
  /** Display name, max 80 chars. It lives inside the versioned graph, so
   *  renaming a step mints a new version. */
  label?: string;
  /** Per-type settings — e.g. `{duration, unit}` for `delay`, `{template_id}`
   *  for `send_email`, `{rule}` for `condition`. */
  config?: Record<string, unknown>;
}

export interface AutomationConnection {
  from: string;
  to: string;
  /** Omitted means `"next"`. */
  branch?: AutomationBranch;
}

/** The denormalized trigger an automation enrolls on. `trigger_key` carries the
 *  tag id (`tag.*`) or the event name (`event`), and is `null` otherwise. */
export interface AutomationTrigger {
  trigger_type: AutomationTriggerType;
  trigger_key: string | null;
}

/** A version's trigger. Both members are `null` on a version whose graph has no
 *  trigger step yet (a normal mid-edit state). */
export interface AutomationVersionTrigger {
  trigger_type: AutomationTriggerType | null;
  trigger_key: string | null;
}

export interface Automation {
  object: "automation";
  id: string;
  publication_id: string;
  name: string;
  description: string | null;
  status: AutomationStatus;
  trigger: AutomationTrigger;
  reentry_policy: AutomationReentryPolicy;
  reentry_window_seconds: number | null;
  on_step_failure: AutomationStepFailureMode;
  /** The live version number, or `null` before a graph has been saved. */
  version: number | null;
  version_id: string | null;
  graph_hash: string | null;
  steps: AutomationStep[];
  connections: AutomationConnection[];
  /** Runs currently `scheduled`, `executing` or `waiting_event`. */
  active_run_count: number;
  /** `false` when `issues` contains at least one `error`. */
  valid: boolean;
  issues: AutomationValidationIssue[];
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

/** A row returned by `automations.list` — omits the graph (`steps`,
 *  `connections`) and its validation (`valid`, `issues`). */
export interface AutomationListItem {
  object: "automation";
  id: string;
  publication_id: string;
  name: string;
  description: string | null;
  status: AutomationStatus;
  trigger: AutomationTrigger;
  reentry_policy: AutomationReentryPolicy;
  reentry_window_seconds: number | null;
  on_step_failure: AutomationStepFailureMode;
  version: number | null;
  version_id: string | null;
  graph_hash: string | null;
  active_run_count: number;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

/** The dry-run answer: what a save would have said, with nothing written. */
export interface AutomationValidation {
  object: "automation_validation";
  valid: boolean;
  issues: AutomationValidationIssue[];
}

/** A row returned by `automations.listVersions` — no graph. */
export interface AutomationVersionListItem {
  object: "automation_version";
  id: string;
  automation_id: string;
  publication_id: string;
  version: number;
  graph_hash: string;
  trigger: AutomationVersionTrigger;
  is_live: boolean;
  created_at: string;
}

/** A single version, including the graph it pinned. */
export interface AutomationVersion extends AutomationVersionListItem {
  steps: AutomationStep[];
  connections: AutomationConnection[];
}

export interface AutomationStepEmailMetrics {
  sent: number;
  /** CURRENTLY delivered — accepted and not subsequently bounced. A mailbox that
   *  accepts a message and later rejects it leaves both timestamps set, so that
   *  message counts under `bounced` only and `delivered + bounced` can never
   *  exceed `sent`. */
  delivered: number;
  /** Pixel-based; undercounts. */
  opened: number;
  /** Link-based; undercounts. */
  clicked: number;
  bounced: number;
}

export interface AutomationStepMetrics {
  /** Unique only WITHIN a version. An all-versions aggregate can therefore
   *  contain two entries with the same `step_key` and different `step_type` —
   *  a key deleted as one kind of step and re-added as another. Index this
   *  array on the PAIR, or the second entry overwrites the first. */
  step_key: string;
  step_type: AutomationStepType | null;
  label: string | null;
  entered: number;
  succeeded: number;
  failed: number;
  skipped: number;
  /** Runs parked on this step right now. */
  waiting: number;
  /** `{condition_met, condition_not_met}` for a `condition`,
   *  `{event_received, timeout}` for a `wait_for_event`. */
  branches?: Record<string, number>;
  /** Present on `send_email` steps only. */
  email?: AutomationStepEmailMetrics;
}

export interface AutomationRunMetrics {
  /** Point-in-time, deliberately not intersected with `since`/`until`. */
  active: number;
  waiting: number;
  /** Every run status is present, defaulting to `0`. */
  totals: Record<AutomationRunStatus, number>;
}

export interface AutomationMetrics {
  object: "automation_metrics";
  automation_id: string;
  publication_id: string;
  /** The version these numbers are SCOPED to. `null` when no `version` was
   *  requested, because the aggregate then spans every version and there is no
   *  one version the counts belong to. Caption a chart or an export from this
   *  field — never from {@link AutomationMetrics.graph_version}, which would
   *  title combined traffic with a single version number. */
  version: number | null;
  version_id: string | null;
  /** The version whose graph supplied `steps[]` and their labels: the live one,
   *  or the requested one when `version` was passed. `null` only for an
   *  automation with no live version. This says where the LABELS came from, not
   *  what the counts cover. */
  graph_version: number | null;
  graph_version_id: string | null;
  since: string | null;
  until: string | null;
  /** Always `true` — test runs send real email but never count here. */
  excludes_test_runs: boolean;
  runs: AutomationRunMetrics;
  steps: AutomationStepMetrics[];
}

/** The 202 answer to `automations.test` — a short run shape, not the full detail. */
export interface AutomationTestRun {
  object: "automation_run";
  id: string;
  automation_id: string;
  publication_id: string;
  status: AutomationRunStatus;
  contact: { id: string; email: string | null };
  version: number | null;
  version_id: string | null;
  current_step_key: string | null;
  is_test: true;
  started_at: string;
  created_at: string;
}

/** What `pause`/`archive` return: the automation, plus the blast radius the
 *  server actually applied. */
export type AutomationLifecycleResult = Automation & { canceled_runs: number };

/** Steps plus (optionally) connections. Omitting `connections` links the steps
 *  in ARRAY ORDER with `branch: "next"`; a graph containing a `condition` or a
 *  `wait_for_event` is rejected with `connections_required_for_branching`,
 *  because array order cannot express a branch. */
export interface ValidateAutomationInput {
  publication_id: string;
  steps: AutomationStep[];
  connections?: AutomationConnection[];
}

/** Create an automation. See {@link ValidateAutomationInput} for what omitting
 *  `connections` means. */
export interface CreateAutomationInput {
  publication_id: string;
  name: string;
  description?: string;
  steps: AutomationStep[];
  connections?: AutomationConnection[];
  reentry_policy?: AutomationReentryPolicy;
  /** Required by (and only legal with) `reentry_policy: "once_per_window"`. */
  reentry_window_seconds?: number | null;
  on_step_failure?: AutomationStepFailureMode;
  /** Dry run: returns an `AutomationValidation` and writes nothing. */
  validate_only?: boolean;
}

/** Update an automation. The graph is replaced wholesale, and `connections` may
 *  only ride along with `steps`. `publication_id` is sent in the query string. */
export interface UpdateAutomationInput {
  publication_id: string;
  name?: string;
  description?: string;
  steps?: AutomationStep[];
  connections?: AutomationConnection[];
  reentry_policy?: AutomationReentryPolicy;
  reentry_window_seconds?: number | null;
  on_step_failure?: AutomationStepFailureMode;
  /** Dry run: returns an `AutomationValidation` and writes nothing. */
  validate_only?: boolean;
}

export interface ListAutomationsParams {
  publication_id: string;
  status?: AutomationStatus;
  limit?: number;
  after?: string;
}

/** `cancel_runs` defaults differ per verb — `pause` defaults `false`, `archive`
 *  defaults `true`. Omit it to take the server's default. */
export interface AutomationLifecycleParams {
  publication_id: string;
  cancel_runs?: boolean;
}

export interface ListAutomationVersionsParams {
  publication_id: string;
  limit?: number;
  after?: string;
}

export interface AutomationMetricsParams {
  publication_id: string;
  /** Omitted aggregates across ALL versions — and the response then reports
   *  `version: null`, because no single version scopes those counts. */
  version?: number;
  since?: string;
  until?: string;
}

/** Provide exactly one of `contact_id` or `email`. */
export interface TestAutomationInput {
  publication_id: string;
  contact_id?: string;
  email?: string;
  /** Seeds the run's `event.*` namespace for event-triggered graphs. */
  event_properties?: Record<string, unknown>;
}

/**
 * The `automations` resource (multi-step journeys). Access via
 * `mailtea.automations`; runs live on `mailtea.automationRuns`.
 */
export class Automations {
  constructor(private readonly request: RequestFn) {}

  /** Check a graph without creating anything. Errors come back as coded
   *  `issues[]`, not as a 400. */
  validate(input: ValidateAutomationInput): Promise<AutomationValidation> {
    return this.request<AutomationValidation>("POST", "/v1/automations/validate", input);
  }

  /** Create an automation (born `draft`). With `validate_only: true` nothing is
   *  written and an {@link AutomationValidation} comes back instead. */
  create(input: CreateAutomationInput & { validate_only: true }): Promise<AutomationValidation>;
  create(input: CreateAutomationInput): Promise<Automation>;
  create(input: CreateAutomationInput): Promise<Automation | AutomationValidation> {
    return this.request<Automation | AutomationValidation>("POST", "/v1/automations", input);
  }

  /** List automations in a publication (graph omitted). */
  list(params: ListAutomationsParams): Promise<ListResponse<AutomationListItem>> {
    return this.request<ListResponse<AutomationListItem>>(
      "GET",
      `/v1/automations${query({ ...params })}`
    );
  }

  /** Retrieve a single automation, including the live version's graph. */
  get(id: string, params: { publication_id: string }): Promise<Automation> {
    return this.request<Automation>(
      "GET",
      `/v1/automations/${encodeURIComponent(id)}${query({ ...params })}`
    );
  }

  /** Update an automation. Saving is never blocked for a draft/paused/archived
   *  automation — issues ride along; a graph change on an ACTIVE one with errors
   *  is a 422 (pause, save, start). */
  update(
    id: string,
    input: UpdateAutomationInput & { validate_only: true }
  ): Promise<AutomationValidation>;
  update(id: string, input: UpdateAutomationInput): Promise<Automation>;
  update(
    id: string,
    input: UpdateAutomationInput
  ): Promise<Automation | AutomationValidation> {
    // The automations API reads publication_id from the query string, and its
    // update schema has no such field — so it is stripped from the body.
    const { publication_id, ...body } = input;
    return this.request<Automation | AutomationValidation>(
      "PATCH",
      `/v1/automations/${encodeURIComponent(id)}${query({ publication_id })}`,
      body
    );
  }

  /** Delete an automation. An ACTIVE one is a 409 `automation_active`. */
  delete(id: string, params: { publication_id: string }): Promise<DeletedResponse> {
    return this.request<DeletedResponse>(
      "DELETE",
      `/v1/automations/${encodeURIComponent(id)}${query({ ...params })}`
    );
  }

  /** Start an automation. A graph with errors is refused with a 422
   *  `automation_invalid` carrying the `issues[]`. */
  activate(id: string, params: { publication_id: string }): Promise<Automation> {
    return this.request<Automation>(
      "POST",
      `/v1/automations/${encodeURIComponent(id)}/activate${query({ ...params })}`
    );
  }

  /** Stop new enrollments. `cancel_runs` defaults to FALSE, so in-flight runs
   *  finish on their pinned version — that is what makes pause → save → start
   *  safe. */
  pause(id: string, params: AutomationLifecycleParams): Promise<AutomationLifecycleResult> {
    return this.request<AutomationLifecycleResult>(
      "POST",
      `/v1/automations/${encodeURIComponent(id)}/pause${query({
        publication_id: params.publication_id
      })}`,
      params.cancel_runs === undefined ? undefined : { cancel_runs: params.cancel_runs }
    );
  }

  /** Archive an automation. `cancel_runs` defaults to TRUE here — in-flight runs
   *  exit with `automation_archived`, and a cancelled run cannot be resumed. */
  archive(id: string, params: AutomationLifecycleParams): Promise<AutomationLifecycleResult> {
    return this.request<AutomationLifecycleResult>(
      "POST",
      `/v1/automations/${encodeURIComponent(id)}/archive${query({
        publication_id: params.publication_id
      })}`,
      params.cancel_runs === undefined ? undefined : { cancel_runs: params.cancel_runs }
    );
  }

  /** List an automation's versions, newest first (graph omitted). */
  listVersions(
    id: string,
    params: ListAutomationVersionsParams
  ): Promise<ListResponse<AutomationVersionListItem>> {
    return this.request<ListResponse<AutomationVersionListItem>>(
      "GET",
      `/v1/automations/${encodeURIComponent(id)}/versions${query({ ...params })}`
    );
  }

  /** Retrieve one version, including the graph it pinned. */
  getVersion(
    id: string,
    version: number,
    params: { publication_id: string }
  ): Promise<AutomationVersion> {
    return this.request<AutomationVersion>(
      "GET",
      `/v1/automations/${encodeURIComponent(id)}/versions/${encodeURIComponent(version)}${query({ ...params })}`
    );
  }

  /** Per-step funnel, branch splits and send stats. Test runs are excluded from
   *  every number. Omitting `version` aggregates across all versions. */
  metrics(id: string, params: AutomationMetricsParams): Promise<AutomationMetrics> {
    return this.request<AutomationMetrics>(
      "GET",
      `/v1/automations/${encodeURIComponent(id)}/metrics${query({ ...params })}`
    );
  }

  /** Run the automation once against a real contact. The run bypasses re-entry
   *  but NOT the send path: a test send is a real, billed email. */
  test(id: string, input: TestAutomationInput): Promise<AutomationTestRun> {
    const { publication_id, ...body } = input;
    return this.request<AutomationTestRun>(
      "POST",
      `/v1/automations/${encodeURIComponent(id)}/test${query({ publication_id })}`,
      body
    );
  }
}
