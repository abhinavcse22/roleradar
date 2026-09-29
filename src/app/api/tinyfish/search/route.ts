import { NextRequest, NextResponse } from 'next/server';
import { searchTinyFish } from '@/lib/tinyfish/search';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q');

    if (!q || q.trim() === '') {
      return NextResponse.json(
        {
          error: 'Missing required query parameter "q".',
          usage: '/api/tinyfish/search?q=Product+Manager+AI+India+jobs',
        },
        { status: 400 }
      );
    }

    const location = searchParams.get('location') || undefined;
    const language = searchParams.get('language') || undefined;

    const results = await searchTinyFish(q, { location, language });

    return NextResponse.json({
      success: true,
      query: q.trim(),
      endpoint: 'https://api.search.tinyfish.ai',
      totalResults: results.length,
      results,
      checkedAt: new Date().toISOString(),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown server error';
    const status = message.includes('(401)')
      ? 401
      : message.includes('(429)')
      ? 429
      : message.includes('(400)')
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
