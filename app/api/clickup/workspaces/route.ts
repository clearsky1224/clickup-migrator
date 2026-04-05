import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/clickup';

export async function GET(req: NextRequest) {
  const token = req.headers.get('Authorization') || req.cookies.get('clickup_token')?.value;
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const client = createClient(token);
    const workspaces = await client.getWorkspaces();
    return NextResponse.json(workspaces);
  } catch (err) {
    console.error('Get workspaces error:', err);
    return NextResponse.json({ error: 'Failed to fetch workspaces' }, { status: 500 });
  }
}
