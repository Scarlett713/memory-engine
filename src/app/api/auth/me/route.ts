import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getUserById, toProfile } from '@/lib/server/user-store';

export async function GET() {
  try {
    // ── 从 cookie 读取并验证 token ────────────────────
    const jwtPayload = await getCurrentUser();
    if (!jwtPayload) {
      return NextResponse.json(
        { error: 'UNAUTHORIZED', message: '未登录或登录已过期' },
        { status: 401 }
      );
    }

    // ── 从存储中读取最新用户信息 ──────────────────────
    const user = await getUserById(jwtPayload.userId);
    if (!user) {
      return NextResponse.json(
        { error: 'USER_NOT_FOUND', message: '用户不存在' },
        { status: 404 }
      );
    }

    return NextResponse.json({ user: toProfile(user) });

  } catch (err) {
    console.error('[me]', err);
    return NextResponse.json(
      { error: 'SERVER_ERROR', message: '服务器错误' },
      { status: 500 }
    );
  }
}
