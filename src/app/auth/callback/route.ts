import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const origin = requestUrl.origin

  if (code) {
    const supabase = await createClient()
    await supabase.auth.exchangeCodeForSession(code)
  }

  return NextResponse.redirect(`${origin}/dashboard`)
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const body = await request.json()

  if (body.event === 'SIGNED_IN' && body.session) {
    await supabase.auth.setSession(body.session)
  } else if (body.event === 'SIGNED_OUT') {
    await supabase.auth.signOut()
  }

  return NextResponse.json({ success: true })
}
