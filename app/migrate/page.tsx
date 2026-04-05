'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  RefreshCw, LogOut, ChevronRight, ChevronDown, CheckSquare,
  Square, Loader2, CheckCircle2, XCircle, AlertCircle, Play,
  ArrowLeft, FolderOpen, List
} from 'lucide-react';
import type { MigrationConfig, MigrationResult } from '@/lib/types';

interface SpaceStructure {
  id: string;
  name: string;
  folders: FolderStructure[];
  folderless_lists: ListStructure[];
}

interface FolderStructure {
  id: string;
  name: string;
  lists: ListStructure[];
}

interface ListStructure {
  id: string;
  name: string;
  task_count: number;
  custom_fields?: { id: string; name: string; type: string }[];
}

const DEFAULT_OPTIONS: MigrationConfig['options'] = {
  migrateTasks: true,
  migrateStatuses: true,
  migrateCustomFields: true,
  migrateSubtasks: true,
  migrateChecklists: false,
  migrateAssignees: false,
  migrateTags: true,
  migratePriority: true,
  migrateDates: true,
  migrateDescriptions: true,
  migrateAttachments: true,
  skipDuplicates: true,
  onlyMyTasks: false,
};

function MigrateContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sourceId = searchParams.get('source') ?? '';
  const targetId = searchParams.get('target') ?? '';

  const [structure, setStructure] = useState<SpaceStructure[]>([]);
  const [targetSpaces, setTargetSpaces] = useState<{ id: string; name: string; folders: { id: string; name: string }[] }[]>([]);
  const [targetSpaceId, setTargetSpaceId] = useState('');
  const [targetFolderId, setTargetFolderId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [selectedLists, setSelectedLists] = useState<Set<string>>(new Set());
  const [options, setOptions] = useState<MigrationConfig['options']>(DEFAULT_OPTIONS);
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<MigrationResult[]>([]);
  const [done, setDone] = useState(false);
  const [expandedErrors, setExpandedErrors] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!sourceId) { router.push('/dashboard'); return; }
    const token = sessionStorage.getItem('clickup_token') || localStorage.getItem('clickup_token');
    if (!token) { router.push('/'); return; }
    sessionStorage.setItem('clickup_token', token);
    const headers = { Authorization: token };
    Promise.all([
      fetch(`/api/clickup/structure/${sourceId}`, { headers }).then((r) => r.json()),
      fetch(`/api/clickup/spaces/${targetId}`, { headers }).then((r) => r.json()),
    ])
      .then(([src, tgt]) => {
        if (src) setStructure(src);
        if (Array.isArray(tgt) && tgt.length > 0) {
          setTargetSpaces(tgt);
          setTargetSpaceId(tgt[0].id);
        }
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [sourceId, targetId, router]);

  // Collect all list IDs in structure
  const allListIds = structure.flatMap((s) => [
    ...s.folderless_lists.map((l) => l.id),
    ...s.folders.flatMap((f) => f.lists.map((l) => l.id)),
  ]);

  const allSelected = allListIds.length > 0 && allListIds.every((id) => selectedLists.has(id));

  function toggleAll() {
    if (allSelected) {
      setSelectedLists(new Set());
    } else {
      setSelectedLists(new Set(allListIds));
    }
  }

  function toggleList(id: string) {
    setSelectedLists((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleFolder(id: string) {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleOption(key: keyof MigrationConfig['options']) {
    setOptions((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  async function runMigration() {
    setRunning(true);
    setDone(false);
    const initialResults: MigrationResult[] = [...selectedLists].map((id) => ({
      listId: id, listName: id, status: 'pending', tasksTotal: 0, tasksMigrated: 0,
    }));
    setResults(initialResults);

    try {
      const token = sessionStorage.getItem('clickup_token') || localStorage.getItem('clickup_token') || '';
      const config: MigrationConfig = {
        sourceWorkspaceId: sourceId,
        targetWorkspaceId: targetId,
        targetSpaceId: targetSpaceId || undefined,
        targetFolderId: targetFolderId || undefined,
        selectedLists: [...selectedLists],
        options,
      };

      const res = await fetch('/api/clickup/migrate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: token },
        body: JSON.stringify(config),
      });

      if (!res.ok || !res.body) { console.error('Stream failed'); return; }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const event = JSON.parse(line.slice(6));
            setResults((prev) => applyEvent(prev, event));
            if (event.type === 'complete') { setDone(true); setRunning(false); }
          } catch { /* skip malformed */ }
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setRunning(false);
      setDone(true);
    }
  }

  function applyEvent(prev: MigrationResult[], event: Record<string, unknown>): MigrationResult[] {
    const listId = event.listId as string;
    return prev.map((r) => {
      if (r.listId !== listId) return r;
      switch (event.type) {
        case 'list_start':   return { ...r, status: 'running' };
        case 'list_name':    return { ...r, listName: event.listName as string };
        case 'tasks_fetched': return { ...r, tasksTotal: event.tasksTotal as number };
        case 'task_done':    return { ...r, tasksMigrated: event.tasksMigrated as number, tasksTotal: event.tasksTotal as number, status: 'running' };
        case 'task_error':   return { ...r, error: `Failed: ${event.taskName}` };
        case 'list_done': {
          const ft = (event.failedTasks as { name: string; error: string }[] | undefined) ?? [];
          return { ...r, status: 'success', tasksMigrated: event.tasksMigrated as number, tasksTotal: event.tasksTotal as number, newListId: event.newListId as string, error: ft.length ? `${ft.length} task(s) failed` : undefined, failedTasks: ft };
        }
        case 'list_error':   return { ...r, status: 'error', error: event.error as string };
        default: return r;
      }
    });
  }

  const optionLabels: Record<keyof MigrationConfig['options'], string> = {
    migrateTasks: 'Tasks',
    migrateStatuses: 'Statuses',
    migrateCustomFields: 'Custom fields',
    migrateSubtasks: 'Subtasks',
    migrateChecklists: 'Checklists',
    migrateAssignees: 'Assignees',
    migrateTags: 'Tags',
    migratePriority: 'Priority',
    migrateDates: 'Due & start dates',
    migrateAttachments: 'Attachments',
    migrateDescriptions: 'Descriptions',
    skipDuplicates: 'Skip duplicates',
    onlyMyTasks: 'Only my tasks',
  };

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      {/* Nav */}
      <nav className="border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <RefreshCw className="w-5 h-5 text-violet-400" />
          <span className="font-semibold text-white text-lg">ClickUp Migrator</span>
        </div>
        <a href="/api/auth/logout" className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-white transition-colors">
          <LogOut className="w-4 h-4" />
          Disconnect
        </a>
      </nav>

      <main className="flex-1 max-w-5xl mx-auto w-full px-6 py-10">
        <button
          onClick={() => router.push('/dashboard')}
          className="flex items-center gap-1.5 text-gray-500 hover:text-white text-sm mb-8 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Change workspaces
        </button>

        <h1 className="text-2xl font-bold text-white mb-1">Configure Migration</h1>
        <p className="text-gray-500 text-sm mb-8">Select which lists to migrate and what data to include.</p>

        {loading && (
          <div className="flex items-center gap-3 text-gray-400">
            <Loader2 className="w-5 h-5 animate-spin text-violet-400" />
            Loading source workspace structure…
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-400 text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {!loading && !error && !done && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* List selector */}
            <div className="lg:col-span-2">
              <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-300">
                    Lists ({selectedLists.size} selected)
                  </span>
                  <button
                    onClick={toggleAll}
                    className="text-xs text-violet-400 hover:text-violet-300 transition-colors"
                  >
                    {allSelected ? 'Deselect all' : 'Select all'}
                  </button>
                </div>

                <div className="divide-y divide-gray-800/60 max-h-[520px] overflow-y-auto">
                  {structure.map((space) => (
                    <div key={space.id}>
                      <div className="px-4 py-2.5 bg-gray-800/40">
                        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                          {space.name}
                        </span>
                      </div>

                      {/* Folderless lists */}
                      {space.folderless_lists.map((list) => (
                        <ListRow
                          key={list.id}
                          list={list}
                          selected={selectedLists.has(list.id)}
                          onToggle={() => toggleList(list.id)}
                          indent={false}
                        />
                      ))}

                      {/* Folders */}
                      {space.folders.map((folder) => (
                        <div key={folder.id}>
                          <button
                            onClick={() => toggleFolder(folder.id)}
                            className="w-full flex items-center gap-2 px-4 py-2.5 text-gray-400 hover:text-white hover:bg-gray-800/30 transition-colors text-sm"
                          >
                            {expandedFolders.has(folder.id)
                              ? <ChevronDown className="w-3.5 h-3.5 flex-shrink-0" />
                              : <ChevronRight className="w-3.5 h-3.5 flex-shrink-0" />
                            }
                            <FolderOpen className="w-3.5 h-3.5 flex-shrink-0 text-gray-500" />
                            <span className="font-medium">{folder.name}</span>
                            <span className="text-xs text-gray-600 ml-auto">{folder.lists.length} lists</span>
                          </button>
                          {expandedFolders.has(folder.id) && folder.lists.map((list) => (
                            <ListRow
                              key={list.id}
                              list={list}
                              selected={selectedLists.has(list.id)}
                              onToggle={() => toggleList(list.id)}
                              indent
                            />
                          ))}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Options + Run */}
            <div className="space-y-4">
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <h3 className="text-sm font-semibold text-gray-300 mb-4">What to migrate</h3>
                <div className="space-y-2.5">
                  {(Object.keys(optionLabels) as (keyof typeof optionLabels)[]).map((key) => (
                    <label
                      key={key}
                      className="flex items-center gap-3 cursor-pointer group"
                    >
                      <div
                        onClick={() => toggleOption(key)}
                        className={`w-9 h-5 rounded-full transition-colors flex-shrink-0 relative ${options[key] ? 'bg-violet-600' : 'bg-gray-700'}`}
                      >
                        <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${options[key] ? 'translate-x-4' : 'translate-x-0.5'}`} />
                      </div>
                      <span className="text-sm text-gray-400 group-hover:text-white transition-colors">
                        {optionLabels[key]}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Destination location */}
              {targetSpaces.length > 0 && (
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                  <h3 className="text-sm font-semibold text-gray-300 mb-3">Destination location</h3>
                  <div className="space-y-2">
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">Space</label>
                      <select
                        value={targetSpaceId}
                        onChange={(e) => { setTargetSpaceId(e.target.value); setTargetFolderId(''); }}
                        className="w-full bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 outline-none focus:border-violet-500"
                      >
                        {targetSpaces.map((s) => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">Folder <span className="text-gray-600">(optional)</span></label>
                      <select
                        value={targetFolderId}
                        onChange={(e) => setTargetFolderId(e.target.value)}
                        className="w-full bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 outline-none focus:border-violet-500"
                      >
                        <option value="">No folder (list goes directly in space)</option>
                        {(targetSpaces.find((s) => s.id === targetSpaceId)?.folders ?? []).map((f) => (
                          <option key={f.id} value={f.id}>{f.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              )}

              <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3">
                <p className="text-amber-400 text-xs leading-relaxed">
                  <strong>Nothing is deleted</strong> from your source workspace. Migration only creates new content in the destination.
                </p>
              </div>

              <button
                onClick={runMigration}
                disabled={selectedLists.size === 0 || running}
                className="w-full flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-500 disabled:bg-gray-800 disabled:text-gray-600 text-white font-semibold py-3 rounded-xl transition-colors disabled:cursor-not-allowed"
              >
                {running
                  ? <><Loader2 className="w-4 h-4 animate-spin" />Migrating…</>
                  : <><Play className="w-4 h-4" />Start Migration</>
                }
              </button>
              {selectedLists.size === 0 && (
                <p className="text-xs text-gray-600 text-center">Select at least one list to proceed.</p>
              )}
            </div>
          </div>
        )}

        {/* Progress / Results */}
        {(running || done) && results.length > 0 && (
          <div className="mt-8">
            <h2 className="text-lg font-semibold text-white mb-4">
              {done ? 'Migration Complete' : 'Migration in Progress…'}
            </h2>
            <div className="space-y-3">
              {results.map((r) => {
                const pct = r.tasksTotal > 0 ? Math.round((r.tasksMigrated / r.tasksTotal) * 100) : 0;
                return (
                <div key={r.listId} className="bg-gray-900 border border-gray-800 rounded-xl px-5 py-4">
                  <div className="flex items-center gap-3 mb-2">
                    <StatusIcon status={r.status} />
                    <p className="text-white font-medium text-sm truncate flex-1">{r.listName}</p>
                    {r.status === 'running' && (
                      <span className="text-xs text-violet-400 font-mono flex-shrink-0">
                        {r.tasksMigrated}{r.tasksTotal > 0 ? ` / ${r.tasksTotal}` : ''} tasks
                      </span>
                    )}
                    {r.status === 'success' && (
                      <span className="text-xs text-green-400 font-medium bg-green-500/10 px-2 py-0.5 rounded-full flex-shrink-0">Done</span>
                    )}
                    {r.status === 'error' && (
                      <span className="text-xs text-red-400 font-medium bg-red-500/10 px-2 py-0.5 rounded-full flex-shrink-0">Failed</span>
                    )}
                  </div>

                  {/* Progress bar — shown while running or on success */}
                  {(r.status === 'running' || r.status === 'success') && r.tasksTotal > 0 && (
                    <div className="mt-1 mb-1.5">
                      <div className="w-full bg-gray-800 rounded-full h-1.5 overflow-hidden">
                        <div
                          className={`h-1.5 rounded-full transition-all duration-300 ${r.status === 'success' ? 'bg-green-500' : 'bg-violet-500'}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Status line */}
                  <p className="text-xs mt-0.5">
                    {r.status === 'pending' && <span className="text-gray-600">Waiting…</span>}
                    {r.status === 'running' && r.tasksTotal === 0 && <span className="text-gray-500">Fetching tasks…</span>}
                    {r.status === 'success' && (
                      <span className="text-gray-500">
                        {r.tasksMigrated} / {r.tasksTotal} tasks migrated
                        {r.error && <span className="text-amber-400 ml-2">⚠ {r.error}</span>}
                      </span>
                    )}
                    {r.status === 'error' && <span className="text-red-400">{r.error}</span>}
                  </p>

                  {/* Expandable failed tasks */}
                  {r.failedTasks && r.failedTasks.length > 0 && (
                    <div className="mt-2">
                      <button
                        onClick={() => setExpandedErrors((prev) => {
                          const next = new Set(prev);
                          next.has(r.listId) ? next.delete(r.listId) : next.add(r.listId);
                          return next;
                        })}
                        className="flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300 transition-colors"
                      >
                        {expandedErrors.has(r.listId) ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                        Show {r.failedTasks.length} failed task{r.failedTasks.length > 1 ? 's' : ''}
                      </button>
                      {expandedErrors.has(r.listId) && (
                        <ul className="mt-1.5 space-y-1">
                          {r.failedTasks.map((ft, i) => (
                            <li key={i} className="text-xs bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-1.5">
                              <span className="text-red-300 font-medium">{ft.name}</span>
                              <span className="text-red-500 ml-2">{ft.error}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
                );
              })}
            </div>

            {done && (
              <div className="mt-6 flex gap-3">
                <button
                  onClick={() => { setDone(false); setResults([]); }}
                  className="px-5 py-2.5 border border-gray-700 text-gray-300 hover:text-white hover:border-gray-500 rounded-xl text-sm font-medium transition-colors"
                >
                  Migrate more lists
                </button>
                <a
                  href="/dashboard"
                  className="px-5 py-2.5 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-sm font-medium transition-colors"
                >
                  Back to workspaces
                </a>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

function ListRow({
  list,
  selected,
  onToggle,
  indent,
}: {
  list: ListStructure;
  selected: boolean;
  onToggle: () => void;
  indent: boolean;
}) {
  return (
    <button
      onClick={onToggle}
      className={`w-full flex items-center gap-3 py-2.5 pr-4 text-left transition-colors hover:bg-gray-800/30 ${indent ? 'pl-10' : 'pl-4'} ${selected ? 'text-white' : 'text-gray-400'}`}
    >
      {selected
        ? <CheckSquare className="w-4 h-4 text-violet-400 flex-shrink-0" />
        : <Square className="w-4 h-4 flex-shrink-0 text-gray-600" />
      }
      <List className="w-3.5 h-3.5 flex-shrink-0 text-gray-600" />
      <span className="text-sm font-medium truncate">{list.name}</span>
      <span className="ml-auto text-xs text-gray-600 flex-shrink-0">{list.task_count ?? 0} tasks</span>
    </button>
  );
}

function StatusIcon({ status }: { status: MigrationResult['status'] }) {
  switch (status) {
    case 'running':
      return <Loader2 className="w-5 h-5 text-violet-400 animate-spin flex-shrink-0" />;
    case 'success':
      return <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0" />;
    case 'error':
      return <XCircle className="w-5 h-5 text-red-400 flex-shrink-0" />;
    default:
      return <div className="w-5 h-5 rounded-full border-2 border-gray-700 flex-shrink-0" />;
  }
}

export default function MigratePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-violet-400 animate-spin" />
      </div>
    }>
      <MigrateContent />
    </Suspense>
  );
}
