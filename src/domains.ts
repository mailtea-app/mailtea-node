import type { RequestFn, ListResponse, DeletedResponse } from "./resource.js";
import { query } from "./resource.js";

export type DomainStatus = "pending" | "verified";
export type DomainPurpose = "email" | "site" | "both";
/** DKIM verification state for an email-purpose domain. */
export type DkimStatus = "pending" | "verified" | "failed";

/** A sending region. Set once, at create — a domain's region never changes. */
export type DomainRegion = "us-west-1" | "eu-west-1" | "ap-southeast-1" | "ap-southeast-2";

/**
 * Per-domain TLS policy. `enforced` routes this domain's mail so a recipient
 * server that will not negotiate TLS gets a bounce rather than a plaintext
 * delivery — deliberately trading a little deliverability for the guarantee.
 */
export type DomainTlsPolicy = "opportunistic" | "enforced";

/** What a DNS row is for. `type` is the DNS type; this is the job it does. */
export type DomainRecordRole =
  | "Ownership"
  | "DKIM"
  | "SPF"
  | "MX"
  | "Return-Path"
  | "Tracking";

/**
 * How far along ONE record is. `not_started` means nothing has ever checked it.
 *
 * It is reported by DKIM, by the return-path pair, and by the `MX` row — the
 * receiving MX is checked by `verify` and the answer is stored, so a domain
 * nobody has verified reads `not_started` and one that has reads what the last
 * verify found. Ownership and tracking rows never report it: for them `pending`
 * is a genuine in-progress state.
 */
export type DomainRecordStatus = "not_started" | "pending" | "verified" | "failed";

/**
 * Every machine-readable refusal a domain or claim request can carry, in the
 * response body's `code`. Parse this rather than the prose in `error`.
 *
 * A refused request rejects with a `MailteaError` whose `code` is one of these,
 * so `err.code === "domain_held_elsewhere"` is the branch that tells a caller
 * to open a claim (see {@link DomainClaims}). It also appears as a failed
 * claim's `failure_reason`.
 */
export type DomainRefusalCode =
  | "invalid_region"
  | "region_not_available"
  | "region_immutable"
  | "tls_not_available"
  | "tracking_subdomain_invalid"
  | "domain_held_elsewhere"
  | "domain_released"
  | "already_owned"
  | "nothing_to_claim"
  | "claim_pending"
  | "claim_not_pending"
  | "claim_host_reserved"
  | "claim_txt_not_found"
  | "claim_txt_mismatch"
  | "claim_release_failed"
  | "claim_provisioning_failed"
  | "claim_internal_error"
  | "claim_expired";

export interface DomainRecord {
  /**
   * What this row is FOR. Read this rather than `type` to tell an ownership TXT
   * from a DKIM TXT. `Claim` appears only on a domain claim's record.
   */
  record: DomainRecordRole | "Claim";
  /** The DNS record type to select at your provider. */
  type: string;
  name: string;
  value: string;
  /** Always `"Auto"` — use whatever TTL your DNS provider defaults to. */
  ttl?: "Auto";
  /** MX priority (present on the receiving and return-path MX records). */
  priority?: number;
  /** The pre-`record` role name, kept for compatibility: `receiving`, `dkim`, `return-path`, `tracking`. */
  purpose?: string;
  status: DomainRecordStatus;
}

export interface Domain {
  object: "domain";
  id: string;
  publication_id: string;
  name: string;
  status: DomainStatus;
  purpose: DomainPurpose;
  /**
   * The region this domain's mail is sent from. Chosen at create and immutable
   * afterwards — to move a domain, delete it and add it again.
   */
  region: DomainRegion;
  tls: DomainTlsPolicy;
  /**
   * The subdomain tracked links are served from (`links` → `links.acme.com`),
   * or `null` when this domain's links are served from the platform host.
   */
  tracking_subdomain: string | null;
  /**
   * Set when another publication proved control of this host's DNS and claimed it.
   * A released domain can no longer send, whatever its `status` says, and the
   * record is closed: remove it and add the domain again, or claim it back.
   */
  released_at: string | null;
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
  /**
   * Whether mail from this domain may carry an open-tracking pixel / rewritten
   * links. Policy: an individual send may decline tracking, but no send can
   * re-enable what is switched off here.
   */
  open_tracking: boolean;
  click_tracking: boolean;
  /**
   * The delegated subdomain used as the envelope sender, so SPF authenticates —
   * and aligns with — your own domain rather than ours, and bounces are routed
   * somewhere you can see. `null` means the feature was never enabled, which is
   * distinct from enabled-but-not-yet-verified (see `custom_return_path_status`).
   * Present on create/get/verify; omitted from list rows.
   */
  custom_return_path?: string | null;
  /**
   * `pending` until the delegated subdomain's MX and SPF records resolve,
   * then `verified`. Until then mail still sends on the default return-path —
   * an unverified return-path costs alignment, never delivery. Present on
   * create/get/verify; omitted from list rows.
   */
  custom_return_path_status?: "pending" | "verified" | "failed" | null;
}

/** Response of `domains.verify` — a {@link Domain} plus the operational MX check. */
export interface VerifiedDomain extends Domain {
  /**
   * Whether the host's MX points at our inbound endpoint (email-purpose only;
   * `null` for site-only domains).
   *
   * Only `verify` returns this field, and only as the answer it just resolved.
   * The same verdict is stored, so the `MX` row in `records` carries it on
   * every later read — read that if you want it outside a verify.
   */
  receiving_mx_found: boolean | null;
}

export interface CreateDomainInput {
  publication_id: string;
  name: string;
  /** Use `email` or `both` for a sending `from` domain. Defaults to `site`. */
  purpose?: DomainPurpose;
  is_primary?: boolean;
  proxy_target?: string;
  /**
   * Where this domain sends from. Defaults to the deployment's default region,
   * and cannot be changed afterwards.
   */
  region?: DomainRegion;
  /** TLS policy for this domain's mail. Defaults to `opportunistic`. */
  tls?: DomainTlsPolicy;
  /** The subdomain to serve tracked links from, e.g. `links`. */
  tracking_subdomain?: string;
}

export interface UpdateDomainInput {
  publication_id: string;
  purpose?: DomainPurpose;
  is_primary?: boolean;
  proxy_target?: string;
  open_tracking?: boolean;
  click_tracking?: boolean;
  /**
   * Custom return-path. `true` delegates the conventional `bounce.<domain>`
   * subdomain; a string names the subdomain explicitly (it must sit under this
   * domain); `false` or `null` reverts to the default return-path.
   */
  custom_return_path?: boolean | string | null;
  /** TLS policy for this domain's mail. */
  tls?: DomainTlsPolicy;
  /**
   * Serve tracked links from your own domain: `links` gives `links.example.com`.
   *
   * `null` removes it, and the domain's links go back to being served from the
   * Mailtea host. Links in mail you have already sent point at the old hostname
   * and stop resolving — that is what removing one costs, and there is no way
   * to reinstate them.
   *
   * An empty string is not a second spelling of `null`; it is refused with
   * `tracking_subdomain_invalid`.
   */
  tracking_subdomain?: string | null;
  // `region` is deliberately absent: a domain's region is fixed at create, and
  // sending one here is refused with 400 `region_immutable`. Delete the domain
  // and add it again to move it.
}

export interface ListDomainsParams {
  publication_id: string;
  limit?: number;
  after?: string;
  /** Only domains sending from this region. */
  region?: DomainRegion;
  /** Only domains in this verification state. */
  status?: DomainStatus;
}

/**
 * The CNAME row on a tracking sub-domain. Narrower than {@link DomainRecord}:
 * a tracking response carries only the DNS fields, with no `record` role and
 * no TTL advice.
 */
export interface TrackingDomainRecord {
  type: "CNAME";
  name: string;
  value: string;
  status: DomainStatus;
}

export interface TrackingDomain {
  object: "tracking_domain";
  id: string;
  domain_id: string;
  subdomain: string;
  full_name: string;
  status: DomainStatus;
  /**
   * Whether the host is registered on our edge, which is what makes a
   * certificate exist for it. A verified CNAME with `attached: false` means
   * links are still served from the platform host.
   */
  attached: boolean;
  /** The CNAME record to add. Present on create/verify. */
  records?: TrackingDomainRecord[];
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

export type DomainClaimStatus = "pending" | "completed" | "failed";

/**
 * A request to take a domain back from whichever publication currently holds
 * it, proved by publishing one TXT record.
 */
export interface DomainClaim {
  object: "domain_claim";
  id: string;
  publication_id: string;
  name: string;
  region: DomainRegion;
  status: DomainClaimStatus;
  /** The single TXT record to publish, then `verify()`. */
  records: DomainRecord[];
  /** A {@link DomainRefusalCode} on a failed claim, else `null`. */
  failure_reason: DomainRefusalCode | null;
  /** The domain this claim produced, once it completed. */
  domain_id: string | null;
  /** When a pending claim stops being honoured. `null` once it is settled. */
  expires_at: string | null;
  created_at: string;
  completed_at: string | null;
}

/**
 * Response of `domains.claims.verify` — a {@link DomainClaim} plus the domain
 * the claim produced, in full, so a claimant can publish its DNS without a
 * second request.
 */
export interface VerifiedDomainClaim extends DomainClaim {
  domain: Domain;
}

export interface CreateDomainClaimInput {
  publication_id: string;
  name: string;
  /** Where the claimed domain will send from. Defaults to the default region. */
  region?: DomainRegion;
}

/**
 * Domain claims. Access via `mailtea.domains.claims`.
 *
 * Use this when adding a domain is refused with `domain_held_elsewhere`:
 * another publication holds the host. Open a claim, publish the TXT record it
 * returns to prove you control the DNS, then `verify()`. On success the other
 * publication's domain is released and a fresh one is created for you.
 */
export class DomainClaims {
  constructor(private readonly request: RequestFn) {}

  /** Open a claim. The response `records` lists the TXT record to publish. */
  create(input: CreateDomainClaimInput): Promise<DomainClaim> {
    return this.request<DomainClaim>("POST", "/v1/domains/claim", input);
  }

  /** Poll a claim. */
  get(id: string, params: { publication_id: string }): Promise<DomainClaim> {
    return this.request<DomainClaim>(
      "GET",
      `/v1/domains/claims/${encodeURIComponent(id)}${query({ ...params })}`
    );
  }

  /**
   * Check the TXT record and, if it is there, complete the claim.
   *
   * A record that has not propagated yet leaves the claim `pending` so you can
   * call this again — it does not burn the claim or change the record.
   */
  verify(id: string, params: { publication_id: string }): Promise<VerifiedDomainClaim> {
    return this.request<VerifiedDomainClaim>(
      "POST",
      `/v1/domains/claims/${encodeURIComponent(id)}/verify${query({ ...params })}`
    );
  }

  /** Withdraw a pending claim. Only a pending claim can be cancelled. */
  cancel(id: string, params: { publication_id: string }): Promise<DeletedResponse> {
    return this.request<DeletedResponse>(
      "DELETE",
      `/v1/domains/claims/${encodeURIComponent(id)}${query({ ...params })}`
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

  /** Domain claims — take a domain back from another publication. */
  readonly claims: DomainClaims;

  constructor(private readonly request: RequestFn) {
    this.tracking = new TrackingDomains(request);
    this.claims = new DomainClaims(request);
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

  /**
   * Update a domain's purpose, primary flag, or proxy target.
   *
   * `tracking_subdomain: null` removes the tracking subdomain; omitting the
   * field leaves it alone. The body is sent as given, so the `null` reaches the
   * wire rather than being dropped as a falsy value.
   */
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
