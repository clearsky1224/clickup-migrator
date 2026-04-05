import { NextRequest } from 'next/server';
import { createClient } from '@/lib/clickup';
import type { MigrationConfig, ClickUpTask } from '@/lib/types';

export async function POST(req: NextRequest) {
  const token = req.headers.get('Authorization') || req.cookies.get('clickup_token')?.value;
  if (!token) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });

  const config: MigrationConfig = await req.json();
  const client = createClient(token);

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      function send(data: object) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      }

      // Get current user ID if "only my tasks" is enabled
      let currentUserId: number | undefined;
      if (config.options.onlyMyTasks) {
        const user = await client.getUser();
        currentUserId = user.id;
      }

      for (const listId of config.selectedLists) {
        send({ type: 'list_start', listId, listName: listId, tasksTotal: 0, tasksMigrated: 0 });

        try {
          const sourceList = await client.getList(listId);
          send({ type: 'list_name', listId, listName: sourceList.name });

          let targetSpaceId = config.targetSpaceId;
          if (!targetSpaceId) {
            const targetSpaces = await client.getSpaces(config.targetWorkspaceId);
            if (targetSpaces.length === 0) throw new Error('No spaces in target workspace');
            targetSpaceId = targetSpaces[0].id;
          }

          // Duplicate detection: check if a list with the same name already exists
          let newList: { id: string; name: string; statuses?: unknown[] } | undefined;
          if (config.options.skipDuplicates) {
            const existingLists = config.targetFolderId
              ? await client.getLists(config.targetFolderId)
              : await client.getFolderlessLists(targetSpaceId);
            const existing = existingLists.find((l) => l.name === sourceList.name);
            if (existing) {
              newList = existing;
            }
          }

          if (!newList) {
            const statuses = config.options.migrateStatuses
              ? sourceList.statuses
                  ?.filter((s: { type: string }) => s.type !== 'open' && s.type !== 'closed')
                  .map(({ status, color }: { status: string; color: string }) => ({ status, color }))
              : undefined;
            const cleanStatuses = statuses?.length ? statuses : undefined;
            newList = config.targetFolderId
              ? await client.createList(config.targetFolderId, sourceList.name, cleanStatuses)
              : await client.createFolderlessList(targetSpaceId, sourceList.name, cleanStatuses);
          }

          // Build set of existing task names in target list for duplicate skipping
          let existingTaskNames = new Set<string>();
          if (config.options.skipDuplicates) {
            const existingTasks = await client.getAllTasks(newList!.id);
            existingTaskNames = new Set(existingTasks.map((t) => t.name));
          }

          let fieldMap: Record<string, string> = {};
          let sourceUrlFieldId: string | undefined;
          const targetFields = await client.getCustomFields(newList!.id);

          if (config.options.migrateCustomFields) {
            const sourceFields = await client.getCustomFields(listId);
            for (const sf of sourceFields) {
              const match = targetFields.find((tf) => tf.name === sf.name && tf.type === sf.type);
              if (match) fieldMap[sf.id] = match.id;
            }
          }

          // Look for a URL field named "ClickUp URL" in the target list
          const urlField = targetFields.find(
            (f) => f.name.toLowerCase() === 'clickup url' && (f.type === 'url' || f.type === 'text' || f.type === 'short_text')
          );
          if (urlField) sourceUrlFieldId = urlField.id;

          const tasks = config.options.migrateTasks ? await client.getAllTasks(listId) : [];
          let topLevel = tasks.filter((t) => !t.parent);

          // Filter by current user if enabled
          if (currentUserId) {
            topLevel = topLevel.filter((t) =>
              t.assignees?.some((a) => a.id === currentUserId)
            );
          }

          // Filter out duplicates
          if (config.options.skipDuplicates && existingTaskNames.size > 0) {
            topLevel = topLevel.filter((t) => !existingTaskNames.has(t.name));
          }
          const totalCount = topLevel.length + (config.options.migrateSubtasks
            ? topLevel.reduce((sum, t) => sum + (t.subtasks?.length ?? 0), 0)
            : 0);

          send({ type: 'tasks_fetched', listId, tasksTotal: totalCount });

          let migrated = 0;
          const failedTasks: { name: string; error: string }[] = [];
          const CONCURRENCY = 3;

          async function runTask(task: ClickUpTask, parentId?: string) {
            try {
              const newTask = await migrateTask(client, task, newList!.id, config, fieldMap, parentId, sourceUrlFieldId);
              migrated++;
              send({ type: 'task_done', listId, taskName: task.name, tasksMigrated: migrated, tasksTotal: totalCount });

              if (!parentId && config.options.migrateSubtasks && task.subtasks?.length) {
                for (const sub of task.subtasks) {
                  await runTask(sub, newTask.id);
                }
              }
            } catch (e) {
              const msg = e instanceof Error ? e.message : String(e);
              failedTasks.push({ name: task.name, error: msg });
              send({ type: 'task_error', listId, taskName: task.name, error: msg });
            }
          }

          for (let i = 0; i < topLevel.length; i += CONCURRENCY) {
            await Promise.all(topLevel.slice(i, i + CONCURRENCY).map((t) => runTask(t)));
          }

          send({
            type: 'list_done',
            listId,
            listName: sourceList.name,
            newListId: newList!.id,
            tasksMigrated: migrated,
            tasksTotal: totalCount,
            errors: failedTasks.map((f) => `"${f.name}": ${f.error}`),
            failedTasks,
          });
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Unknown error';
          send({ type: 'list_error', listId, error: msg });
        }
      }

      send({ type: 'complete' });
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}

async function migrateTask(
  client: ReturnType<typeof createClient>,
  task: ClickUpTask,
  targetListId: string,
  config: MigrationConfig,
  fieldMap: Record<string, string>,
  parentId?: string,
  sourceUrlFieldId?: string
): Promise<ClickUpTask> {
  // Fetch full task to get markdown_description (with links) and attachments
  const fullTask = await client.getTask(task.id);

  const payload: Record<string, unknown> = { name: task.name };

  const sourceUrl = `https://app.clickup.com/t/${task.id}`;
  const raw = fullTask as unknown as Record<string, unknown>;
  const mdDesc = raw.markdown_description as string | undefined;
  const plainDesc = (raw.description || task.description) as string | undefined;

  if (config.options.migrateDescriptions && (mdDesc || plainDesc)) {
    const suffix = sourceUrlFieldId ? '' : `\n\n---\n🔗 Migrated from: ${sourceUrl}`;
    if (mdDesc) {
      payload.markdown_description = mdDesc + suffix;
    } else {
      payload.description = (plainDesc || '') + suffix;
    }
  } else if (!sourceUrlFieldId) {
    payload.description = `---\n🔗 Migrated from: ${sourceUrl}`;
  }
  if (config.options.migrateStatuses) {
    payload.status = task.status.status;
  }
  if (config.options.migratePriority && task.priority) {
    payload.priority = parseInt(task.priority.id);
  }
  if (config.options.migrateDates) {
    if (task.due_date) payload.due_date = task.due_date;
    if (task.start_date) payload.start_date = task.start_date;
  }
  if (config.options.migrateTags && task.tags?.length) {
    payload.tags = task.tags.map((t) => t.name);
  }
  if (parentId) {
    payload.parent = parentId;
  }

  let newTask: ClickUpTask;
  try {
    newTask = await client.createTask(targetListId, payload as unknown as ClickUpTask & { name: string });
  } catch (err: unknown) {
    // Retry without status/dates if ClickUp rejects the payload (e.g. status doesn't exist yet)
    const status = (err as { response?: { status?: number } })?.response?.status;
    if (status === 400) {
      const { status: _s, due_date: _d, start_date: _sd, ...safePayload } = payload as Record<string, unknown>;
      newTask = await client.createTask(targetListId, safePayload as unknown as ClickUpTask & { name: string });
    } else {
      throw err;
    }
  }

  // Set ClickUp URL field if it exists in the target list
  if (sourceUrlFieldId) {
    try {
      await client.setCustomFieldValue(newTask.id, sourceUrlFieldId, sourceUrl);
    } catch {
      // Skip silently
    }
  }

  // Migrate custom field values
  if (config.options.migrateCustomFields && task.custom_fields?.length) {
    for (const field of task.custom_fields) {
      if (field.value !== null && field.value !== undefined && fieldMap[field.id]) {
        try {
          await client.setCustomFieldValue(newTask.id, fieldMap[field.id], field.value);
        } catch {
          // Skip field value errors silently
        }
      }
    }
  }

  // Migrate attachments — use fullTask fetched at start of this function
  if (config.options.migrateAttachments) {
    try {
      const attachments = fullTask.attachments ?? [];
      console.log(`[migrate] Task "${task.name}" has ${attachments.length} attachment(s)`);
      for (const att of attachments) {
        try {
          await client.copyAttachment(
            newTask.id,
            att.url,
            att.title || `attachment.${att.extension || 'bin'}`,
            att.mimetype || 'application/octet-stream'
          );
        } catch (attErr) {
          console.error(`[migrate] Attachment "${att.title}" failed:`, attErr instanceof Error ? attErr.message : attErr);
        }
      }
    } catch (fetchErr) {
      console.error(`[migrate] Could not fetch task "${task.name}" for attachments:`, fetchErr instanceof Error ? fetchErr.message : fetchErr);
    }
  }

  return newTask;
}
