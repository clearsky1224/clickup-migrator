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

    const structure = await Promise.all(
      spaces.map(async (space) => {
        const [folders, folderlessLists] = await Promise.all([
          client.getFolders(space.id),
          client.getFolderlessLists(space.id),
        ]);

        const foldersWithLists = await Promise.all(
          folders.map(async (folder) => {
            const lists = await client.getLists(folder.id);
            const listsWithFields = await Promise.all(
              lists.map(async (list) => {
                const fields = await client.getCustomFields(list.id);
                return { ...list, custom_fields: fields };
              })
            );
            return { ...folder, lists: listsWithFields };
          })
        );

        const folderlessWithFields = await Promise.all(
          folderlessLists.map(async (list) => {
            const fields = await client.getCustomFields(list.id);
            return { ...list, custom_fields: fields };
          })
        );

        return {
          ...space,
          folders: foldersWithLists,
          folderless_lists: folderlessWithFields,
        };
      })
    );

    return NextResponse.json(structure);
  } catch (err) {
    console.error('Get structure error:', err);
    return NextResponse.json({ error: 'Failed to fetch workspace structure' }, { status: 500 });
  }
}
