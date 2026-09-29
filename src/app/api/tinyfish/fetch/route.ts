import { NextRequest, NextResponse } from 'next/server';
import { fetchTinyFish, isValidHttpUrl } from '@/lib/tinyfish/fetch';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const targetUrl = searchParams.get('url');

    if (!targetUrl || targetUrl.trim() === '') {
      return NextResponse.json(
        {
          error: 'Missing required query parameter "url".',
          usage: '/api/tinyfish/fetch?url=https%3A%2F%2Fexample.com',
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

    const result = await fetchTinyFish(trimmedUrl);

    return NextResponse.json({
      success: true,
      endpoint: 'https://api.fetch.tinyfish.ai',
      result,
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
