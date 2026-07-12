import type { RequestFn } from "./resource.js";

export type ApiKeyPermission = "full_access" | "sending_access";

export interface CreateApiKeyInput {
  /** A label for the key. 1–50 characters. */
  name: string;
  /** Access level. Defaults to `full_access`. */
  permission?: ApiKeyPermission;
  /** Publication to scope a `sending_access` key to. */
  domain_id?: string;
}

export interface CreatedApiKey {
  id: string;
  /** The full token — returned ONCE on creation. Store it securely. */
  token: string;
}

export interface ApiKeyListItem {
  id: string;
  name: string;
  created_at: string;
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

  /** Revoke (delete) an API key by id. */
  revoke(id: string): Promise<void> {
    return this.request<void>("DELETE", `/v1/api-keys/${encodeURIComponent(id)}`);
  }
}
