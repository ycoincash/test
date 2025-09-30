import { NextRequest, NextResponse } from 'next/server';
import { getTokens } from 'next-firebase-auth-edge';
import { getServerConfig } from '@/lib/firebase/auth-edge-config';

export async function POST(request: NextRequest) {
  try {
    // CSRF protection: Validate Origin/Referer
    const origin = request.headers.get('origin');
    const referer = request.headers.get('referer');
    const host = request.headers.get('host');
    
    if (!origin && !referer) {
      return NextResponse.json({ error: 'Missing origin/referer' }, { status: 403 });
    }
    
    const requestOrigin = origin || (referer ? new URL(referer).origin : null);
    if (!requestOrigin || !host || !requestOrigin.includes(host)) {
      return NextResponse.json({ error: 'Invalid origin' }, { status: 403 });
    }

    const { idToken } = await request.json();

    if (!idToken) {
      return NextResponse.json({ error: 'Missing idToken' }, { status: 400 });
    }

    const config = getServerConfig();
    
    // Verify ID token and get session tokens
    const tokens = await getTokens(idToken, {
      serviceAccount: config.serviceAccount,
      apiKey: config.apiKey,
      cookieName: config.cookieName,
      cookieSignatureKeys: config.cookieSignatureKeys,
      cookieSerializeOptions: config.cookieSerializeOptions,
    });

    const response = NextResponse.json({ 
      success: true,
      user: {
        uid: tokens.decodedToken.uid,
        email: tokens.decodedToken.email
      }
    }, { status: 200 });

    // Set HTTP-only, secure, signed cookie
    response.cookies.set({
      name: config.cookieName,
      value: tokens.token,
      ...config.cookieSerializeOptions,
    });

    return response;
  } catch (error) {
    console.error('Session creation error:', error);
    return NextResponse.json(
      { error: 'Failed to create session' },
      { status: 500 }
    );
  }
}

// Reject non-POST requests
export async function GET() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}
