import { NextResponse } from 'next/server';
import { clearTokenCookie } from '@/lib/auth';

export async function POST() {
  try {
    await clearTokenCookie();
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[logout]', err);
    return NextResponse.json(
      { error: 'SERVER_ERROR', message: '服务器错误' },
      { status: 500 }
    );
  }
}
