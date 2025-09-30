import { NextRequest, NextResponse } from 'next/server';
import { authMiddleware } from 'next-firebase-auth-edge';
import { getServerConfig } from './src/lib/firebase/auth-edge-config';

const PUBLIC_PATHS = ['/register', '/login', '/', '/blog'];

export async function middleware(request: NextRequest) {
  const config = getServerConfig();

  return authMiddleware(request, {
    loginPath: '/api/auth/session',
    logoutPath: '/api/auth/logout',
    apiKey: config.apiKey,
    cookieName: config.cookieName,
    cookieSignatureKeys: config.cookieSignatureKeys,
    cookieSerializeOptions: config.cookieSerializeOptions,
    serviceAccount: config.serviceAccount,
    handleValidToken: async ({ token, decodedToken }, headers) => {
      if (PUBLIC_PATHS.some(path => request.nextUrl.pathname.startsWith(path))) {
        return NextResponse.redirect(new URL('/dashboard', request.url));
      }
      
      return NextResponse.next({
        request: { headers }
      });
    },
    handleInvalidToken: async (reason) => {
      if (PUBLIC_PATHS.some(path => request.nextUrl.pathname.startsWith(path))) {
        return NextResponse.next();
      }
      
      if (request.nextUrl.pathname.startsWith('/api/')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      
      return NextResponse.redirect(new URL('/login', request.url));
    },
    handleError: async (error) => {
      console.error('Authentication middleware error:', error);
      
      if (request.nextUrl.pathname.startsWith('/api/')) {
        return NextResponse.json({ error: 'Authentication error' }, { status: 500 });
      }
      
      return NextResponse.redirect(new URL('/login', request.url));
    },
  });
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/admin/:path*',
    '/phone-verification',
    '/api/auth/session',
    '/api/auth/logout',
  ],
};
