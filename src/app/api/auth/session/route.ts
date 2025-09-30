import { NextRequest, NextResponse } from 'next/server';
import { getTokens } from 'next-firebase-auth-edge';
import { getServerConfig } from '@/lib/firebase/auth-edge-config';

export async function POST(request: NextRequest) {
  try {
    const { idToken } = await request.json();

    if (!idToken) {
      return NextResponse.json({ error: 'Missing idToken' }, { status: 400 });
    }

    const config = getServerConfig();
    
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
