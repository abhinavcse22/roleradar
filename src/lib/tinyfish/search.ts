import {
  NormalizedSearchResult,
  SearchOptions,
  TinyFishSearchApiResponse,
  TinyFishSearchResultItem,
} from './types';

const TINYFISH_SEARCH_ENDPOINT = 'https://api.search.tinyfish.ai';

function extractDomain(urlStr: string): string {
  try {
    const parsed = new URL(urlStr);
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

export async function searchTinyFish(
  query: string,
  options?: SearchOptions
): Promise<NormalizedSearchResult[]> {
  const apiKey = process.env.TINYFISH_API_KEY;

  if (!apiKey || apiKey.trim() === '') {
    throw new Error('TINYFISH_API_KEY is not configured on the server.');
  }

  const trimmedQuery = query.trim();
  if (!trimmedQuery) {
    throw new Error('Search query cannot be empty.');
  }

  const url = new URL(TINYFISH_SEARCH_ENDPOINT);
  url.searchParams.set('query', trimmedQuery);

  if (options?.location) {
    url.searchParams.set('location', options.location);
  }
  if (options?.language) {
    url.searchParams.set('language', options.language);
  }

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      'X-API-Key': apiKey.trim(),
      Accept: 'application/json',
    },
    // Avoid caching in discovery workflows
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
      `TinyFish Search API error (${response.status}): ${errorDetails || response.statusText}`
    );
  }

  const data = (await response.json()) as TinyFishSearchApiResponse;
  const rawResults: TinyFishSearchResultItem[] = Array.isArray(data.results)
    ? data.results
    : [];

  return rawResults.map((item, idx) => ({
    title: item.title?.trim() || 'Untitled Job Posting',
    url: item.url?.trim() || '',
    snippet: item.snippet?.trim() || '',
    domain: item.site_name?.trim() || extractDomain(item.url || ''),
    position: typeof item.position === 'number' ? item.position : idx + 1,
  }));
}
