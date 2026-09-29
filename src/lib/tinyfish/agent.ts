import {
  AgentJobItem,
  AgentRunParams,
  NormalizedAgentRunResult,
  TinyFishAgentSSEEvent,
} from './types';
import { isValidHttpUrl } from './fetch';

const TINYFISH_AGENT_SSE_ENDPOINT = 'https://agent.tinyfish.ai/v1/automation/run-sse';

export function buildJobDiscoveryAgentGoal(params: {
  role: string;
  location: string;
  keywords: string[];
}): string {
  const kwStr = params.keywords.length > 0 ? params.keywords.join(', ') : 'Any relevant skills';

  return `
1. Open the supplied live careers page.
2. Search, filter, or browse for open positions matching:
   - Role: ${params.role}
   - Location: ${params.location}
   - Keywords: ${kwStr}
3. Find CURRENT/open roles only. Do not include closed or expired jobs.
4. Navigate the site, click into search or department filters if needed to locate matching openings.
5. Return structured JSON with this exact schema:
{
  "jobs": [
    {
      "title": "string",
      "company": "string",
      "location": "string",
      "employment_type": "string or null",
      "work_mode": "string or null",
      "description": "string",
      "requirements": ["string"],
      "apply_url": "string",
      "source_url": "string"
    }
  ]
}

Important rules:
- Do not invent missing information. If a field is unavailable, return null or an empty array.
- Do not include closed jobs.
- apply_url must be a real URL found on the page (or full URL link to apply).
- Return valid JSON matching the schema above.
`.trim();
}

function resolveUrl(relativeOrAbsolute: string, baseUrl: string): string {
  try {
    return new URL(relativeOrAbsolute, baseUrl).toString();
  } catch {
    return relativeOrAbsolute;
  }
}

export async function runTinyFishAgent(
  params: AgentRunParams
): Promise<NormalizedAgentRunResult> {
  const apiKey = process.env.TINYFISH_API_KEY;

  if (!apiKey || apiKey.trim() === '') {
    throw new Error('TINYFISH_API_KEY is not configured on the server.');
  }

  const targetUrl = params.url.trim();
  if (!targetUrl || !isValidHttpUrl(targetUrl)) {
    throw new Error('Invalid URL. Must be a valid HTTP or HTTPS address.');
  }

  const goal = buildJobDiscoveryAgentGoal({
    role: params.role || 'Product Manager',
    location: params.location || 'India',
    keywords: params.keywords || [],
  });

  const response = await fetch(TINYFISH_AGENT_SSE_ENDPOINT, {
    method: 'POST',
    headers: {
      'X-API-Key': apiKey.trim(),
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
    },
    body: JSON.stringify({
      url: targetUrl,
      goal,
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
      `TinyFish Agent API error (${response.status}): ${errorDetails || response.statusText}`
    );
  }

  if (!response.body) {
    throw new Error('TinyFish Agent SSE response did not contain a readable body.');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  const eventsObserved: string[] = [];
  let lastPurpose: string | undefined;
  let finalStatus = 'INCOMPLETE';
  let runId: string | undefined;
  let finalResult: unknown;
  let agentError: string | undefined;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (!line.startsWith('data:')) continue;
        const dataStr = line.slice(5).trim();
        if (!dataStr) continue;

        try {
          const event = JSON.parse(dataStr) as TinyFishAgentSSEEvent;
          const eventType = event.type || 'UNKNOWN';

          if (!eventsObserved.includes(eventType)) {
            eventsObserved.push(eventType);
          }

          if (event.run_id) {
            runId = event.run_id;
          }

          if (event.purpose) {
            lastPurpose = event.purpose;
          }

          params.onProgress?.(event);

          if (eventType === 'COMPLETE') {
            finalStatus = event.status || 'COMPLETED';
            finalResult = event.result;

            if (event.error) {
              agentError =
                typeof event.error === 'string'
                  ? event.error
                  : event.error.message || JSON.stringify(event.error);
            }
          }
        } catch {
          // Ignore unparseable individual SSE data chunks defensively
        }
      }
    }
  } catch (err) {
    throw new Error(
      `Stream reading error: ${err instanceof Error ? err.message : 'Unknown stream error'}`
    );
  }

  // Parse structured jobs from finalResult
  const jobs: AgentJobItem[] = [];

  if (finalResult && typeof finalResult === 'object') {
    const rawObj = finalResult as Record<string, unknown>;
    const rawJobs = Array.isArray(rawObj.jobs)
      ? rawObj.jobs
      : Array.isArray(finalResult)
      ? finalResult
      : [];

    for (const item of rawJobs) {
      if (item && typeof item === 'object') {
        const j = item as Record<string, unknown>;
        const title = typeof j.title === 'string' ? j.title.trim() : '';
        if (!title) continue;

        const applyUrl =
          typeof j.apply_url === 'string' && j.apply_url.trim()
            ? resolveUrl(j.apply_url.trim(), targetUrl)
            : targetUrl;

        jobs.push({
          title,
          company: typeof j.company === 'string' ? j.company.trim() : '',
          location: typeof j.location === 'string' ? j.location.trim() : params.location,
          employment_type: typeof j.employment_type === 'string' ? j.employment_type : null,
          work_mode: typeof j.work_mode === 'string' ? j.work_mode : null,
          description: typeof j.description === 'string' ? j.description.trim() : '',
          requirements: Array.isArray(j.requirements)
            ? j.requirements.map((r) => String(r).trim()).filter(Boolean)
            : [],
          apply_url: applyUrl,
          source_url:
            typeof j.source_url === 'string' && j.source_url.trim()
              ? resolveUrl(j.source_url.trim(), targetUrl)
              : targetUrl,
        });
      }
    }
  }

  const isSuccess =
    finalStatus === 'COMPLETED' && (!agentError || agentError.length === 0);

  return {
    success: isSuccess,
    runId,
    status: finalStatus,
    jobs,
    rawResult: finalResult,
    error: agentError,
    eventsObserved,
    lastPurpose,
    checkedAt: new Date().toISOString(),
  };
}
