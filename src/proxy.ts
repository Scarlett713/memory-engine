import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';

const PUBLIC_PATHS = [
  '/login',
  '/register',
  '/api/auth/login',
  '/api/auth/register',
];

const STATIC_PREFIXES = ['/_next', '/favicon.ico'];

// BUG-06：/api/* 未登录 / token 失效返 401 JSON，页面路径仍 302 跳 /login。
// 原先一律 302，前端 fetch 会跟随重定向拿到 HTML，各 route 内的 401 分支形同虚设。
function isApiPath(pathname: string) {
  return pathname === '/api' || pathname.startsWith('/api/');
}

function unauthorized() {
  return NextResponse.json({ message: '未登录。' }, { status: 401 });
}

export default async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 静态资源直接放行
  if (STATIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return NextResponse.next();
  }

  // 公开路径直接放行
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // 读取 token
  const token = req.cookies.get('memory-engine-token')?.value;

  if (!token) {
    if (isApiPath(pathname)) {
      return unauthorized();
    }

    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // 验证 token
  const payload = await verifyToken(token);
  if (!payload) {
    if (isApiPath(pathname)) {
      return unauthorized();
    }

    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('redirect', pathname);
    loginUrl.searchParams.set('reason', 'expired');
    return NextResponse.redirect(loginUrl);
  }

  // 注入用户信息到请求头
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set('x-user-id', payload.userId);
  requestHeaders.set('x-user-email', payload.email);
  requestHeaders.set('x-user-type', payload.userType);

  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
