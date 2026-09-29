import { NextRequest, NextResponse } from 'next/server';
import { searchJobs } from '@/lib/pipeline/searchPipeline';
import { UserPreferences } from '@/lib/matching/types';

export async function POST(request: NextRequest) {
  try {
    let body: Partial<UserPreferences>;

    try {
      body = (await request.json()) as Partial<UserPreferences>;
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON request body.' },
        { status: 400 }
      );
    }

    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { error: 'Request body must be a valid JSON object.' },
        { status: 400 }
      );
    }

    const role = typeof body.role === 'string' ? body.role.trim() : '';
    const location = typeof body.location === 'string' ? body.location.trim() : '';

    if (!role) {
      return NextResponse.json(
        { error: 'Field "role" is required and cannot be empty.' },
        { status: 400 }
      );
    }

    if (!location) {
      return NextResponse.json(
        { error: 'Field "location" is required and cannot be empty.' },
        { status: 400 }
      );
    }

    const keywords = Array.isArray(body.keywords)
      ? body.keywords.map((k) => String(k).trim()).filter(Boolean)
      : [];

    const preferences: UserPreferences = {
      role,
      location,
      keywords,
      seniority: body.seniority || 'Any',
      workMode: body.workMode || 'Any',
      visaPreference: body.visaPreference || 'Any',
    };

    const pipelineResult = await searchJobs(preferences);

    return NextResponse.json({
      success: true,
      jobs: pipelineResult.jobs,
      stats: pipelineResult.stats,
      executedAt: pipelineResult.executedAt,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown pipeline error';
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
