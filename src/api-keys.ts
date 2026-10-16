import type { RequestFn } from "./resource.js";
import type { EmailMode } from "./types.js";

export type ApiKeyPermission = "full_access" | "sending_access";

export interface CreateApiKeyInput {
  /** A label for the key. 1–50 characters. */
  name: string;
  /** Access level. Defaults to `full_access`. */
  permission?: ApiKeyPermission;
  /** Publication to scope a `sending_access` key to. */
  domain_id?: string;
  /**
   * `live` (default) or `test`. A test key is prefixed `mt_test_`, takes the
   * same scopes and travels the same auth path, but its sends are simulated
   * and it reads only test mail.
   *
   * It is not a data sandbox: a test key reads and writes your real contacts,
   * templates, senders and webhooks. Only delivery is simulated.
   */
  mode?: EmailMode;
}

export interface CreatedApiKey {
  id: string;
  /** The full token — returned ONCE on creation. Store it securely. */
  token: string;
  /** The mode the key was minted in: `live` or `test`. */
  mode: EmailMode;
}

export interface ApiKeyListItem {
  id: string;
  name: string;
  /** `live` or `test`. */
  mode: EmailMode;
  created_at: string;
}

/** What the calling key is for, from `apiKeys.current()`. */
export interface CurrentApiKey {
  object: "api_key";
  id: string;
  /** `live` or `test`. */
  mode: EmailMode;
  scopes: string[];
  team: { id: string; name: string | null };
  /** Null for a key that reaches the whole team rather than one publication. */
  publication: {
    id: string;
    name: string;
    /** The Mailtea-managed `{slug}.mailtea.email` receiving domain, or null. */
    receiving_domain: string | null;
  } | null;
  /**
   * Hard limits, the ones a send is refused at; null means the plan has none.
   * `ramp` is the new-team daily limit while it lasts (first week by default).
   */
  plan: {
    key: string;
    name: string;
    daily_limit: number | null;
    monthly_limit: number | null;
    ramp: { daily_limit: number; ends_at: string } | null;
  };
}

/**
 * The `apiKeys` resource. Access via `mailtea.apiKeys`. Requires a token with
 * `settings:write`; a key can never be granted scopes the calling token does
 * not already hold.
 */
export class ApiKeys {
  constructor(private readonly request: RequestFn) {}

  /**
   * Create an API key. The `token` is returned ONCE — store it securely. The
   * calling token must already hold every scope the new key would grant.
   */
  create(input: CreateApiKeyInput): Promise<CreatedApiKey> {
    return this.request<CreatedApiKey>("POST", "/v1/api-keys", input);
  }

  /** List API keys (token values are never returned). */
  list(): Promise<{ data: ApiKeyListItem[] }> {
    return this.request<{ data: ApiKeyListItem[] }>("GET", "/v1/api-keys");
  }

  /**
   * Describe the key making the request: its team, its publication and that
   * publication's receiving domain, its scopes, its mode and the plan limits.
   * Any key may call it; no scope is needed.
   */
  current(): Promise<CurrentApiKey> {
    return this.request<CurrentApiKey>("GET", "/v1/api-keys/current");
  }

  /** Revoke (delete) an API key by id. */
  revoke(id: string): Promise<void> {
    return this.request<void>("DELETE", `/v1/api-keys/${encodeURIComponent(id)}`);
  }
}
