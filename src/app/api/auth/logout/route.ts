import { NextRequest, NextResponse } from 'next/server';
import { getServerConfig } from '@/lib/firebase/auth-edge-config';

export async function POST(request: NextRequest) {
  try {
    // CSRF protection: Strict origin validation
    const origin = request.headers.get('origin');
    const referer = request.headers.get('referer');
    
    if (!origin && !referer) {
      return NextResponse.json({ error: 'Missing origin/referer' }, { status: 403 });
    }
    
    const requestOrigin = origin || (referer ? new URL(referer).origin : null);
    const expectedOrigin = request.nextUrl.origin;
    
    if (requestOrigin !== expectedOrigin) {
      console.error('CSRF: Origin mismatch', { requestOrigin, expectedOrigin });
      return NextResponse.json({ error: 'Invalid origin' }, { status: 403 });
    }

    const config = getServerConfig();
    
    const response = NextResponse.json({ success: true }, { status: 200 });

    // Clear main auth cookie
    response.cookies.delete({
      name: config.cookieName,
      path: '/',
    });

    // Clear signature cookie (if using signed cookies)
    response.cookies.delete({
      name: `${config.cookieName}.sig`,
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json(
      { error: 'Failed to logout' },
      { status: 500 }
    );
  }
}

// Reject non-POST requests
export async function GET() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}
