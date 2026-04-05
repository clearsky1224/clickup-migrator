import { NextRequest, NextResponse } from 'next/server';
import { exchangeCodeForToken } from '@/lib/clickup';

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code');
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  if (!code) {
    return NextResponse.redirect(`${appUrl}/?error=no_code`);
  }

  try {
    const token = await exchangeCodeForToken(code);
    const response = NextResponse.redirect(`${appUrl}/dashboard`);
    response.cookies.set('clickup_token', token.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30,
      path: '/',
    });
    return response;
  } catch (err) {
    console.error('OAuth callback error:', err);
    return NextResponse.redirect(`${appUrl}/?error=auth_failed`);
  }
}
