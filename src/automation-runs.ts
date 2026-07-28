import type { RequestFn, ListResponse } from "./resource.js";
import type { AutomationConnection, AutomationStep, AutomationStepType } from "./automations.js";
import { query } from "./resource.js";

export type AutomationRunStatus =
  | "scheduled"
  | "executing"
  | "waiting_event"
  | "completed"
  | "failed"
  | "canceled"
  | "exited";

export type AutomationStepRunStatus = "succeeded" | "failed" | "skipped";

/** The contact a run is for. `email` is `null` when the contact was deleted —
 *  "a run for a contact that is gone" and "a run with no contact" (the whole
 *  object is `null`) are different facts. */
export interface AutomationRunContact {
  id: string;
  email: string | null;
}

/** A row returned by `automationRuns.list` — no graph, no step runs. */
export interface AutomationRunListItem {
  object: "automation_run";
  id: string;
  automation_id: string;
  publication_id: string;
  status: AutomationRunStatus;
  contact: AutomationRunContact | null;
  version: number | null;
  version_id: string | null;
  current_step_key: string | null;
  current_step_label: string | null;
  current_step_type: AutomationStepType | null;
  is_test: boolean;
  exit_reason: string | null;
  started_at: string;
  completed_at: string | null;
  created_at: string;
}

export interface AutomationStepRun {
  object: "automation_step_run";
  id: string;
  step_key: string;
  step_type: AutomationStepType;
  label: string | null;
  status: AutomationStepRunStatus;
  /** Allowlisted projection of what the step recorded, chosen per step type.
   *
   *  One key can appear on ANY step type: `recorded_after_run_ended: true`, set
   *  when the run ended (cancel, archive, mid-run unsubscribe) while this step
   *  was still in flight. The side effect still happened — the email went out
   *  and was billed — so the attempt is recorded and counted in metrics, but
   *  the run did not resume and no `automation.step.completed` webhook fired.
   *  It is the only thing that explains a `completed_at` later than the run's
   *  own. */
  output: Record<string, unknown>;
  /** `true` when the endpoint dropped part of `output` (e.g. an oversized
   *  `http_request` response body) rather than the engine never writing it. */
  output_redacted: boolean;
  error: string | null;
  attempts: number;
  started_at: string;
  /** Can be LATER than the run's own `completed_at` — see `output`. */
  completed_at: string;
}

/** Where a parked run is waiting. Both members are `null` on a terminal run; a
 *  run on a `delay` has `resume_at` only; one on a `wait_for_event` has both. */
export interface AutomationRunWaiting {
  resume_at: string | null;
  waiting_event_name: string | null;
}

export interface AutomationRun {
  object: "automation_run";
  id: string;
  automation_id: string;
  publication_id: string;
  status: AutomationRunStatus;
  contact: AutomationRunContact | null;
  version: number | null;
  version_id: string | null;
  /** The PINNED graph this run entered on, never the live one. */
  steps: AutomationStep[];
  connections: AutomationConnection[];
  current_step_key: string | null;
  current_step_label: string | null;
  is_test: boolean;
  exit_reason: string | null;
  step_budget_used: number;
  attempts: number;
  last_error: string | null;
  waiting: AutomationRunWaiting;
  step_runs: AutomationStepRun[];
  started_at: string;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ListAutomationRunsParams {
  publication_id: string;
  /** One status or several — several are sent as a comma-separated list. */
  status?: AutomationRunStatus | AutomationRunStatus[];
  contact_id?: string;
  is_test?: boolean;
  limit?: number;
  after?: string;
}

/**
 * The `automation runs` resource (one contact's journey through one
 * automation). Access via `mailtea.automationRuns`.
 */
export class AutomationRuns {
  constructor(private readonly request: RequestFn) {}

  /** List an automation's runs, newest first. */
  list(
    automationId: string,
    params: ListAutomationRunsParams
  ): Promise<ListResponse<AutomationRunListItem>> {
    const { status, is_test, ...rest } = params;
    return this.request<ListResponse<AutomationRunListItem>>(
      "GET",
      `/v1/automations/${encodeURIComponent(automationId)}/runs${query({
        ...rest,
        status: Array.isArray(status) ? status.join(",") : status,
        is_test: is_test === undefined ? undefined : String(is_test)
      })}`
    );
  }

  /** Retrieve a run, including its step runs and the graph version it pinned. */
  get(
    automationId: string,
    runId: string,
    params: { publication_id: string }
  ): Promise<AutomationRun> {
    return this.request<AutomationRun>(
      "GET",
      `/v1/automations/${encodeURIComponent(automationId)}/runs/${encodeURIComponent(runId)}${query({ ...params })}`
    );
  }

  /** Stop a run. The status becomes `canceled`; a cancelled run cannot resume. */
  cancel(
    automationId: string,
    runId: string,
    params: { publication_id: string }
  ): Promise<AutomationRun> {
    return this.request<AutomationRun>(
      "POST",
      `/v1/automations/${encodeURIComponent(automationId)}/runs/${encodeURIComponent(runId)}/cancel${query({ ...params })}`
    );
  }
}
