import { NextRequest, NextResponse } from 'next/server';
import { getServerConfig } from '@/lib/firebase/auth-edge-config';

export async function POST(request: NextRequest) {
  try {
    const config = getServerConfig();
    
    const response = NextResponse.json({ success: true }, { status: 200 });

    response.cookies.delete({
      name: config.cookieName,
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
