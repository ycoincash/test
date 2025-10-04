import { NextRequest, NextResponse } from 'next/server';
import { updateSession } from './lib/supabase/middleware';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  const response = await updateSession(request);
  
  const protectedPaths = ['/dashboard', '/admin', '/phone-verification'];
  const isProtectedPath = protectedPaths.some(path => pathname.startsWith(path));
  
  if (isProtectedPath) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    
    const token = request.cookies.get('sb-access-token')?.value || 
                  request.cookies.get(`sb-${supabaseUrl.split('//')[1].split('.')[0]}-auth-token`)?.value;
    
    if (!token) {
      const redirectUrl = new URL('/login', request.url);
      return NextResponse.redirect(redirectUrl);
    }
  }
  
  return response;
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/admin/:path*',
    '/phone-verification',
  ],
};
