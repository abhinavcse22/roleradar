import { NextRequest, NextResponse } from 'next/server';
import { getTinyFishAgentRun } from '@/lib/tinyfish/agent';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const runId = searchParams.get('runId')?.trim();
    const url = searchParams.get('url')?.trim() || undefined;
    const location = searchParams.get('location')?.trim() || undefined;

    if (!runId) {
      return NextResponse.json(
        { success: false, error: 'Missing required runId parameter.' },
        { status: 400 }
      );
    }

    const runResult = await getTinyFishAgentRun(runId, url, location);

    return NextResponse.json({
      success: true,
      runId: runResult.runId,
      status: runResult.status,
      jobs: runResult.jobs,
      error: runResult.error,
      finishedAt: runResult.finishedAt,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to retrieve agent run status';
    const status = message.includes('Missing required') ? 400 : 500;

    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status }
    );
  }
}
