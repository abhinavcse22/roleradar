import {
  FetchOptions,
  NormalizedFetchResult,
  TinyFishFetchApiResponse,
} from './types';

const TINYFISH_FETCH_ENDPOINT = 'https://api.fetch.tinyfish.ai';

function extractDomain(urlStr: string): string {
  try {
    const parsed = new URL(urlStr);
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

export function isValidHttpUrl(urlStr: string): boolean {
  try {
    const parsed = new URL(urlStr);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export async function fetchTinyFish(
  targetUrl: string,
  options?: FetchOptions
): Promise<NormalizedFetchResult> {
  const apiKey = process.env.TINYFISH_API_KEY;

  if (!apiKey || apiKey.trim() === '') {
    throw new Error('TINYFISH_API_KEY is not configured on the server.');
  }

  const trimmedUrl = targetUrl.trim();
  if (!trimmedUrl) {
    throw new Error('Target URL cannot be empty.');
  }

  if (!isValidHttpUrl(trimmedUrl)) {
    throw new Error('Invalid URL. Must be a valid HTTP or HTTPS web address.');
  }

  const response = await fetch(TINYFISH_FETCH_ENDPOINT, {
    method: 'POST',
    headers: {
      'X-API-Key': apiKey.trim(),
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      urls: [trimmedUrl],
      format: options?.format || 'markdown',
    }),
    cache: 'no-store',
  });

  if (!response.ok) {
    let errorDetails = '';
    try {
      const errJson = (await response.json()) as Record<string, unknown>;
      errorDetails =
        typeof errJson.message === 'string'
          ? errJson.message
          : typeof errJson.error === 'string'
          ? errJson.error
          : JSON.stringify(errJson);
    } catch {
      errorDetails = await response.text();
    }

    throw new Error(
      `TinyFish Fetch API error (${response.status}): ${errorDetails || response.statusText}`
    );
  }

  const data = (await response.json()) as TinyFishFetchApiResponse;

  if (Array.isArray(data.errors) && data.errors.length > 0) {
    const firstErr = data.errors[0];
    const errMsg = firstErr?.error || firstErr?.message || 'Failed to read page content';
    throw new Error(`TinyFish Fetch error: ${errMsg}`);
  }

  const item = Array.isArray(data.results) && data.results.length > 0 ? data.results[0] : null;

  if (!item) {
    throw new Error('TinyFish Fetch returned an empty result for this URL.');
  }

  const content = item.text?.trim() || '';

  return {
    url: trimmedUrl,
    finalUrl: item.final_url?.trim() || item.url?.trim() || trimmedUrl,
    title: item.title?.trim() || 'Untitled Page',
    description: item.description?.trim() || '',
    language: item.language || 'en',
    content,
    contentLength: content.length,
    latencyMs: typeof item.latency_ms === 'number' ? Math.round(item.latency_ms) : undefined,
    domain: extractDomain(item.final_url || item.url || trimmedUrl),
    checkedAt: new Date().toISOString(),
  };
}
