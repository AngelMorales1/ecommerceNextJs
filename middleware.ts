import { NextRequest, NextResponse } from 'next/server';
import { isAdminPagePath, isCheckoutPath, isApiAdminPath } from './lib/middleware/routes';
import {
  getSession,
  hasAdminRole,
  response401,
  redirectToLogin,
  redirectToHome,
} from './lib/middleware/auth';

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  if (isApiAdminPath(pathname)) {
    const session = await getSession(request);
    if (!session) return response401();
    if (!hasAdminRole(session)) return response401();
    return NextResponse.next();
  }

  if (isAdminPagePath(pathname)) {
    const session = await getSession(request);
    if (!session) return redirectToLogin(request);
    if (!hasAdminRole(session)) return redirectToHome(request);
    return NextResponse.next();
  }

  if (isCheckoutPath(pathname)) {
    const session = await getSession(request);
    if (!session) return redirectToLogin(request);
    return NextResponse.next();
  }

  return NextResponse.next();
}
