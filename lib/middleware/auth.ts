import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { VALID_ADMIN_ROLES } from './constants';

export type SessionWithRole = { user?: { role?: string } };

export async function getSession(req: NextRequest): Promise<SessionWithRole | null> {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  return token as SessionWithRole | null;
}

export function hasAdminRole(session: SessionWithRole | null): boolean {
  return !!session?.user?.role && VALID_ADMIN_ROLES.includes(session.user.role as any);
}

/** Respuesta 401 JSON para APIs */
export function response401(): NextResponse {
  return new NextResponse(JSON.stringify({ message: 'No autorizado' }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Redirect a login guardando la página solicitada */
export function redirectToLogin(request: NextRequest): NextResponse {
  const url = new URL('/auth/login', request.nextUrl.origin);
  url.searchParams.set('p', request.nextUrl.pathname);
  return NextResponse.redirect(url);
}

/** Redirect a home (cuando no tiene rol admin) */
export function redirectToHome(request: NextRequest): NextResponse {
  return NextResponse.redirect(new URL('/', request.nextUrl.origin));
}
