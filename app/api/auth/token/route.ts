import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/clickup';

export async function POST(req: NextRequest) {
  const { token } = await req.json();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  if (!token || !token.startsWith('pk_')) {
    return NextResponse.json({ error: 'Invalid token. ClickUp personal tokens start with pk_' }, { status: 400 });
  }

  try {
    // Validate token by hitting the workspaces endpoint
    const client = createClient(token);
    await client.getWorkspaces();

    const response = NextResponse.json({ ok: true });
    response.cookies.set('clickup_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30,
      path: '/',
    });
    return response;
  } catch {
    return NextResponse.json({ error: 'Token is invalid or has no workspace access' }, { status: 401 });
  }
}
