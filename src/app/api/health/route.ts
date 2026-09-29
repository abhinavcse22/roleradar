import { NextResponse } from 'next/server';

export async function GET() {
  const apiKey = process.env.TINYFISH_API_KEY;
  const exists = typeof apiKey === 'string';
  const nonEmpty = exists && apiKey.trim().length > 0;

  return NextResponse.json({
    status: 'ok',
    tinyFishApiKey: {
      exists,
      nonEmpty,
    },
  });
}
