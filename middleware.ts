import { NextRequest, NextResponse } from 'next/server';
import { authMiddleware } from 'next-firebase-auth-edge';
import { getServerConfig } from './src/lib/firebase/auth-edge-config';

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
      // User has valid token and is trying to access protected route
      return NextResponse.next({
        request: { headers }
      });
    },
    handleInvalidToken: async (reason) => {
      // User has invalid/no token trying to access protected route
      console.log('Invalid token, redirecting to login:', reason);
      return NextResponse.redirect(new URL('/login', request.url));
    },
    handleError: async (error) => {
      console.error('Authentication middleware error:', error);
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
    // Note: /api/auth/logout is excluded to prevent CSRF bypass
    // Logout route handles CSRF validation and cookie clearing itself
  ],
};
