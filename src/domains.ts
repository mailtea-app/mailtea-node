import type { RequestFn, ListResponse, DeletedResponse } from "./resource.js";
import { query } from "./resource.js";

export type DomainStatus = "pending" | "verified";
export type DomainPurpose = "email" | "site" | "both";
/** DKIM verification state for an email-purpose domain. */
export type DkimStatus = "pending" | "verified" | "failed";

export interface DomainRecord {
  record?: string;
  type: string;
  name: string;
  value: string;
  /** MX priority (present on the inbound MX record). */
  priority?: number;
  /** What the record is for, e.g. `receiving` or `dkim`. */
  purpose?: string;
  status: DomainStatus | "failed";
}

export interface Domain {
  object: "domain";
  id: string;
  publication_id: string;
  name: string;
  status: DomainStatus;
  purpose: DomainPurpose;
  /** Mailtea-managed domain (born verified, owns no DNS records). */
  is_system: boolean;
  is_primary: boolean;
  proxy_target: string;
  /** DNS records to add before verifying. Present on create/get/verify. */
  records?: DomainRecord[];
  /** DKIM state. Present on create/get/verify; omitted from list rows. */
  dkim_status?: DkimStatus | null;
  verified_at: string | null;
  created_at: string;
  updated_at: string;
}

/** Response of `domains.verify` — a {@link Domain} plus the operational MX check. */
export interface VerifiedDomain extends Domain {
  /** Whether the host's MX points at our inbound endpoint (email-purpose only;
   *  `null` for site-only domains). */
  receiving_mx_found: boolean | null;
}

export interface CreateDomainInput {
  publication_id: string;
  name: string;
  /** Use `email` or `both` for a sending `from` domain. Defaults to `site`. */
  purpose?: DomainPurpose;
  is_primary?: boolean;
  proxy_target?: string;
}

export interface UpdateDomainInput {
  publication_id: string;
  purpose?: DomainPurpose;
  is_primary?: boolean;
  proxy_target?: string;
}

export interface ListDomainsParams {
  publication_id: string;
  limit?: number;
  after?: string;
}

export interface TrackingDomain {
  object: "tracking_domain";
  id: string;
  domain_id: string;
  subdomain: string;
  full_name: string;
  status: DomainStatus;
  /** The CNAME record to add. Present on create/verify. */
  records?: DomainRecord[];
  verified_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateTrackingDomainInput {
  publication_id: string;
  /** Sub-domain label (lowercase alphanumeric and hyphens), e.g. `links`. */
  subdomain: string;
}

/**
 * Tracking sub-domains (CNAME) under a domain — used to serve open-pixel and
 * click-tracking links from your own domain. Access via `mailtea.domains.tracking`.
 */
export class TrackingDomains {
  constructor(private readonly request: RequestFn) {}

  /** Add a tracking sub-domain. The response `records` lists the CNAME to add. */
  create(domainId: string, input: CreateTrackingDomainInput): Promise<TrackingDomain> {
    return this.request<TrackingDomain>(
      "POST",
      `/v1/domains/${encodeURIComponent(domainId)}/tracking-domains${query({ publication_id: input.publication_id })}`,
      { subdomain: input.subdomain }
    );
  }

  /** List tracking sub-domains for a domain. */
  list(
    domainId: string,
    params: { publication_id: string }
  ): Promise<{ object: "list"; data: TrackingDomain[] }> {
    return this.request<{ object: "list"; data: TrackingDomain[] }>(
      "GET",
      `/v1/domains/${encodeURIComponent(domainId)}/tracking-domains${query({ ...params })}`
    );
  }

  /** Verify a tracking sub-domain by checking its CNAME record. */
  verify(
    domainId: string,
    trackingDomainId: string,
    params: { publication_id: string }
  ): Promise<TrackingDomain> {
    return this.request<TrackingDomain>(
      "POST",
      `/v1/domains/${encodeURIComponent(domainId)}/tracking-domains/${encodeURIComponent(trackingDomainId)}/verify${query({ ...params })}`
    );
  }

  /** Delete a tracking sub-domain. */
  delete(
    domainId: string,
    trackingDomainId: string,
    params: { publication_id: string }
  ): Promise<DeletedResponse> {
    return this.request<DeletedResponse>(
      "DELETE",
      `/v1/domains/${encodeURIComponent(domainId)}/tracking-domains/${encodeURIComponent(trackingDomainId)}${query({ ...params })}`
    );
  }
}

/**
 * The `domains` resource (email/site sending domains). Access via
 * `mailtea.domains`. Register a domain, add the returned DNS `records`, then
 * `verify()` it before sending from it.
 */
export class Domains {
  /** Tracking sub-domains (CNAME) under a domain. */
  readonly tracking: TrackingDomains;

  constructor(private readonly request: RequestFn) {
    this.tracking = new TrackingDomains(request);
  }

  /** Register a domain. The response `records` lists the DNS records to add. */
  create(input: CreateDomainInput): Promise<Domain> {
    return this.request<Domain>("POST", "/v1/domains", input);
  }

  /** List domains in a publication. */
  list(params: ListDomainsParams): Promise<ListResponse<Domain>> {
    return this.request<ListResponse<Domain>>(
      "GET",
      `/v1/domains${query({ ...params })}`
    );
  }

  /** Retrieve a single domain, including its DNS `records`. */
  get(id: string, params: { publication_id: string }): Promise<Domain> {
    return this.request<Domain>(
      "GET",
      `/v1/domains/${encodeURIComponent(id)}${query({ ...params })}`
    );
  }

  /** Verify a domain by checking its DNS records; `status` becomes `verified`. */
  verify(id: string, params: { publication_id: string }): Promise<VerifiedDomain> {
    return this.request<VerifiedDomain>(
      "POST",
      `/v1/domains/${encodeURIComponent(id)}/verify${query({ ...params })}`
    );
  }

  /** Update a domain's purpose, primary flag, or proxy target. */
  update(id: string, input: UpdateDomainInput): Promise<Domain> {
    return this.request<Domain>(
      "PATCH",
      `/v1/domains/${encodeURIComponent(id)}${query({ publication_id: input.publication_id })}`,
      input
    );
  }

  /** Delete a domain. */
  delete(
    id: string,
    params: { publication_id: string }
  ): Promise<DeletedResponse> {
    return this.request<DeletedResponse>(
      "DELETE",
      `/v1/domains/${encodeURIComponent(id)}${query({ ...params })}`
    );
  }
}
