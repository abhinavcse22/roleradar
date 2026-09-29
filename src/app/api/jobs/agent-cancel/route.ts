import { NextRequest, NextResponse } from 'next/server';
import { cancelTinyFishAgentRun } from '@/lib/tinyfish/agent';

export async function POST(request: NextRequest) {
  try {
    let body: { runId?: string };

    try {
      body = (await request.json()) as { runId?: string };
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON request body.' },
        { status: 400 }
      );
    }

    if (!body || typeof body !== 'object' || !body.runId || typeof body.runId !== 'string' || !body.runId.trim()) {
      return NextResponse.json(
        { success: false, error: 'Field "runId" is required and cannot be empty.' },
        { status: 400 }
      );
    }

    const cancelResult = await cancelTinyFishAgentRun(body.runId.trim());

    return NextResponse.json({
      success: true,
      runId: cancelResult.runId,
      status: cancelResult.status,
      cancelledAt: cancelResult.cancelledAt,
      message: cancelResult.message,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to cancel agent run';
    const status = message.includes('required') ? 400 : 500;

    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status }
    );
  }
}
