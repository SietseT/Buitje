import { config } from "../config.js";

interface KnmiFileEntry {
  filename: string;
  size: number;
  created: string;
  lastModified: string;
}

interface KnmiListFilesResponse {
  files: KnmiFileEntry[];
}

interface KnmiDownloadUrlResponse {
  temporaryDownloadUrl: string;
}

function authHeaders(): Record<string, string> {
  return { Authorization: config.knmi.apiKey };
}

function datasetUrl(suffix: string): string {
  return `${config.knmi.apiBase}/datasets/${config.knmi.datasetName}/versions/${config.knmi.datasetVersion}${suffix}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * The shared anonymous KNMI key is rate-limited (50 req/min) across ALL
 * anonymous users, so 429s are expected under normal use, not just abuse.
 * Retry with backoff instead of dropping the frame.
 */
async function fetchWithRetry(
  url: string,
  init: RequestInit,
  retries = 4,
): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, init);
    if (res.status !== 429 || attempt >= retries) {
      return res;
    }
    const retryAfterHeader = Number(res.headers.get("Retry-After"));
    const delayMs = Number.isFinite(retryAfterHeader) && retryAfterHeader > 0
      ? retryAfterHeader * 1000
      : 2000 * (attempt + 1);
    await sleep(delayMs);
  }
}

/** Returns up to `count` recent filenames, oldest first. */
export async function fetchRecentFilenames(count: number): Promise<string[]> {
  const url = datasetUrl(`/files?maxKeys=${count}&sorting=desc&orderBy=created`);
  const res = await fetchWithRetry(url, { headers: authHeaders() });
  if (!res.ok) {
    throw new Error(`KNMI list-files failed: ${res.status} ${res.statusText}`);
  }
  const body = (await res.json()) as KnmiListFilesResponse;
  return body.files.map((f) => f.filename).reverse();
}

export async function downloadFile(filename: string): Promise<Buffer> {
  const urlRes = await fetchWithRetry(datasetUrl(`/files/${filename}/url`), {
    headers: authHeaders(),
  });
  if (!urlRes.ok) {
    throw new Error(
      `KNMI get-download-url failed for ${filename}: ${urlRes.status} ${urlRes.statusText}`,
    );
  }
  const { temporaryDownloadUrl } = (await urlRes.json()) as KnmiDownloadUrlResponse;

  const fileRes = await fetchWithRetry(temporaryDownloadUrl, {});
  if (!fileRes.ok) {
    throw new Error(
      `KNMI file download failed for ${filename}: ${fileRes.status} ${fileRes.statusText}`,
    );
  }
  const arrayBuffer = await fileRes.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
