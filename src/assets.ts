import type { RequestFn, ListResponse } from "./resource.js";
import { query } from "./resource.js";

export interface Asset {
  object: "asset";
  id: string;
  /** The permanent, public URL. This is what an image block's `src` takes. */
  url: string;
  publication_id: string;
  filename: string;
  content_type: string;
  byte_size: number;
  width: number | null;
  height: number | null;
  created_at: string;
}

export type AssetContentType =
  | "image/png"
  | "image/jpeg"
  | "image/gif"
  | "image/webp";

export interface UploadAssetInput {
  publication_id: string;
  /**
   * The image bytes. Pass a `Uint8Array`/`Buffer` and the SDK base64-encodes it
   * for you, or pass a base64 string if you already have one — a
   * `data:image/png;base64,…` prefix is stripped server-side either way.
   */
  content: Uint8Array | string;
  content_type: AssetContentType;
  /** A readable name for the library. The stored key is always a fresh id. */
  filename?: string;
  /** Pixel size, when known. The editor uses it to reserve space. */
  width?: number;
  height?: number;
}

export interface ListAssetsParams {
  publication_id: string;
  /** Filter by file name. */
  search?: string;
  /** 1-200, default 100. */
  limit?: number;
}

/** base64 without a `data:` prefix, in Node and in the browser. */
function toBase64(content: Uint8Array | string): string {
  if (typeof content === "string") return content;
  if (typeof Buffer !== "undefined") {
    return Buffer.from(content).toString("base64");
  }
  let binary = "";
  for (const byte of content) binary += String.fromCharCode(byte);
  return btoa(binary);
}

/**
 * The `assets` resource — a publication's image library. Access via
 * `mailtea.assets`.
 *
 * An email or site image needs an absolute URL, so this is how a picture that
 * is not already in the library gets into one. Pointing an image at a host you
 * do not control breaks the day that host moves the file.
 *
 * PNG, JPEG, GIF or WebP, 5 MB per image. SVG is refused: it can carry script
 * and the file is served from the publication's own domain. The bytes are
 * checked against the declared `content_type`, so a mislabelled file is
 * rejected rather than stored.
 */
export class Assets {
  constructor(private readonly request: RequestFn) {}

  /** List the library, newest first. */
  list(params: ListAssetsParams): Promise<ListResponse<Asset>> {
    return this.request<ListResponse<Asset>>(
      "GET",
      `/v1/assets${query({ ...params })}`
    );
  }

  /** Upload an image and get back the URL to use as an image `src`. */
  upload(input: UploadAssetInput): Promise<Asset> {
    const { content, ...rest } = input;
    return this.request<Asset>("POST", "/v1/assets", {
      ...rest,
      content: toBase64(content)
    });
  }

  /**
   * Retire an asset.
   *
   * The stored file is KEPT and its URL keeps resolving, so images inside
   * already-sent emails do not break. This hides the asset from the library —
   * it does not remove it from any email, template or page that references it.
   */
  delete(
    id: string,
    params: { publication_id: string }
  ): Promise<{ object: "asset"; id: string; deleted: boolean }> {
    return this.request<{ object: "asset"; id: string; deleted: boolean }>(
      "DELETE",
      `/v1/assets/${encodeURIComponent(id)}${query({ ...params })}`
    );
  }
}
