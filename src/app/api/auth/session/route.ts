import { NextRequest, NextResponse } from 'next/server';

// This endpoint is intercepted by authMiddleware which automatically:
// 1. Validates the Authorization: Bearer <token> header
// 2. Sets signed HTTP-only cookies (main + signature)
// 3. Passes through to this handler on success

export async function GET(request: NextRequest) {
  // Verify Authorization header is present
  const authHeader = request.headers.get('authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return NextResponse.json(
      { error: 'Missing Authorization header' },
      { status: 400 }
    );
  }

  // Middleware has already validated token and set cookies
  return NextResponse.json({ success: true }, { status: 200 });
}

// Reject other HTTP methods
export async function POST() {
  return NextResponse.json({ error: 'Method not allowed. Use GET with Authorization header' }, { status: 405 });
}
