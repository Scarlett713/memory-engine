import { NextRequest, NextResponse } from 'next/server';
import { verifyPassword, signToken, setTokenCookie } from '@/lib/auth';
import { getUserByEmail, updateLastLogin, toProfile } from '@/lib/server/user-store';
import type { LoginRequest } from '@/types/user';

export async function POST(req: NextRequest) {
  try {
    const body: LoginRequest = await req.json();
    const { email, password } = body;

    // ── 字段校验 ──────────────────────────────────────
    if (!email || !password) {
      return NextResponse.json(
        { error: 'MISSING_FIELDS', message: '邮箱和密码为必填项' },
        { status: 400 }
      );
    }

    // ── 查找用户 ──────────────────────────────────────
    const user = await getUserByEmail(email);
    if (!user) {
      // Demo/校内场景：为提升 UX，这里区分“未注册”和“密码错误”（会增加邮箱枚举风险；线上建议配合限流/验证码后再区分）
      return NextResponse.json(
        { error: 'INVALID_CREDENTIALS', message: '该邮箱未注册，请先注册一个账号' },
        { status: 401 }
      );
    }

    // ── 验证密码 ──────────────────────────────────────
    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      return NextResponse.json(
        { error: 'INVALID_CREDENTIALS', message: '密码错误，请重试' },
        { status: 401 }
      );
    }

    // ── 更新最后登录时间 ──────────────────────────────
    await updateLastLogin(user.id);

    // ── 签发 token ────────────────────────────────────
    const token = await signToken({
      userId: user.id,
      email: user.email,
      userType: user.userType,
    });
    await setTokenCookie(token);

    return NextResponse.json({ user: toProfile(user) });

  } catch (err) {
    console.error('[login]', err);
    return NextResponse.json(
      { error: 'SERVER_ERROR', message: '服务器错误，请稍后重试' },
      { status: 500 }
    );
  }
}
