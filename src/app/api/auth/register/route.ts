import { NextRequest, NextResponse } from 'next/server';
import { validateEmail, validatePassword, signToken, setTokenCookie } from '@/lib/auth';
import { createUser, getUserByEmail } from '@/lib/server/user-store';
import type { RegisterRequest } from '@/types/user';

export async function POST(req: NextRequest) {
  try {
    const body: RegisterRequest = await req.json();
    const { email, password, userType, orgName } = body;

    // ── 字段校验 ──────────────────────────────────────
    if (!email || !password || !userType) {
      return NextResponse.json(
        { error: 'MISSING_FIELDS', message: '邮箱、密码和账号类型为必填项' },
        { status: 400 }
      );
    }

    if (!validateEmail(email)) {
      return NextResponse.json(
        { error: 'INVALID_EMAIL', message: '邮箱格式不正确' },
        { status: 400 }
      );
    }

    const passwordCheck = validatePassword(password);
    if (!passwordCheck.valid) {
      return NextResponse.json(
        { error: 'INVALID_PASSWORD', message: passwordCheck.message },
        { status: 400 }
      );
    }

    if (userType === 'org' && !orgName?.trim()) {
      return NextResponse.json(
        { error: 'MISSING_ORG_NAME', message: '机构用户必须填写单位名称' },
        { status: 400 }
      );
    }

    if (!['personal', 'org'].includes(userType)) {
      return NextResponse.json(
        { error: 'INVALID_USER_TYPE', message: '账号类型无效' },
        { status: 400 }
      );
    }

    // ── 创建用户 ──────────────────────────────────────
    const profile = await createUser({ email, password, userType, orgName });

    // ── 签发 token，自动登录 ──────────────────────────
    const token = await signToken({
      userId: profile.id,
      email: profile.email,
      userType: profile.userType,
    });
    await setTokenCookie(token);

    return NextResponse.json({ user: profile }, { status: 201 });

  } catch (err) {
    if (err instanceof Error && err.message === 'EMAIL_EXISTS') {
      return NextResponse.json(
        { error: 'EMAIL_EXISTS', message: '该邮箱已注册，请直接登录' },
        { status: 409 }
      );
    }
    console.error('[register]', err);
    return NextResponse.json(
      { error: 'SERVER_ERROR', message: '服务器错误，请稍后重试' },
      { status: 500 }
    );
  }
}
