import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/clickup';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  const token = req.headers.get('Authorization') || req.cookies.get('clickup_token')?.value;
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { workspaceId } = await params;

  try {
    const client = createClient(token);
    const spaces = await client.getSpaces(workspaceId);

    const result = await Promise.all(
      spaces.map(async (space) => {
        const folders = await client.getFolders(space.id);
        return {
          id: space.id,
          name: space.name,
          folders: folders.map((f) => ({ id: f.id, name: f.name })),
        };
      })
    );

    return NextResponse.json(result);
  } catch (err) {
    console.error('Get spaces error:', err);
    return NextResponse.json({ error: 'Failed to fetch spaces' }, { status: 500 });
  }
}
