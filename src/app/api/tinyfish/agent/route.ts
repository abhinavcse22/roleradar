import { NextRequest, NextResponse } from 'next/server';
import { runTinyFishAgent } from '@/lib/tinyfish/agent';
import { isValidHttpUrl } from '@/lib/tinyfish/fetch';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const targetUrl = searchParams.get('url');

    if (!targetUrl || targetUrl.trim() === '') {
      return NextResponse.json(
        {
          error: 'Missing required query parameter "url".',
          usage:
            '/api/tinyfish/agent?url=https%3A%2F%2Fexample.com%2Fcareers&role=Product%20Manager&location=India&keywords=AI,SaaS',
        },
        { status: 400 }
      );
    }

    const trimmedUrl = targetUrl.trim();
    if (!isValidHttpUrl(trimmedUrl)) {
      return NextResponse.json(
        {
          error: 'Invalid URL. Parameter "url" must begin with http:// or https://',
        },
        { status: 400 }
      );
    }

    const role = searchParams.get('role')?.trim() || 'Product Manager';
    const location = searchParams.get('location')?.trim() || 'India';
    const rawKeywords = searchParams.get('keywords')?.trim() || 'AI, SaaS';
    const keywords = rawKeywords
      .split(',')
      .map((k) => k.trim())
      .filter(Boolean);

    const wantsStream =
      searchParams.get('stream') === 'true' ||
      request.headers.get('accept')?.includes('text/event-stream');

    if (wantsStream) {
      const encoder = new TextEncoder();
      const customReadable = new ReadableStream({
        async start(controller) {
          try {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ type: 'CONNECTING', message: 'Connecting to TinyFish Agent...' })}\n\n`
              )
            );

            const result = await runTinyFishAgent({
              url: trimmedUrl,
              role,
              location,
              keywords,
              onProgress: (event) => {
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify(event)}\n\n`)
                );
              },
            });

            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  type: 'DONE',
                  success: result.success,
                  status: result.status,
                  runId: result.runId,
                  totalJobs: result.jobs.length,
                  jobs: result.jobs,
                  eventsObserved: result.eventsObserved,
                  checkedAt: result.checkedAt,
                  error: result.error,
                })}\n\n`
              )
            );
            controller.close();
          } catch (streamErr: unknown) {
            const errMessage =
              streamErr instanceof Error ? streamErr.message : 'Agent stream error';
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  type: 'ERROR',
                  error: errMessage,
                })}\n\n`
              )
            );
            controller.close();
          }
        },
      });

      return new Response(customReadable, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache, no-transform',
          Connection: 'keep-alive',
        },
      });
    }

    // Default: synchronous JSON response
    const agentResult = await runTinyFishAgent({
      url: trimmedUrl,
      role,
      location,
      keywords,
    });

    return NextResponse.json({
      success: agentResult.success,
      endpoint: 'https://agent.tinyfish.ai/v1/automation/run-sse',
      status: agentResult.status,
      runId: agentResult.runId,
      totalJobs: agentResult.jobs.length,
      jobs: agentResult.jobs,
      eventsObserved: agentResult.eventsObserved,
      lastPurpose: agentResult.lastPurpose,
      checkedAt: agentResult.checkedAt,
      error: agentResult.error,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown server error';
    const status = message.includes('(401)')
      ? 401
      : message.includes('(429)')
      ? 429
      : message.includes('Invalid URL') || message.includes('Missing required')
      ? 400
      : 500;

    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status }
    );
  }
}
