'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw, LogOut, ArrowRight, Users, AlertCircle } from 'lucide-react';
import type { ClickUpWorkspace } from '@/lib/types';

export default function DashboardPage() {
  const router = useRouter();
  const [workspaces, setWorkspaces] = useState<ClickUpWorkspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [source, setSource] = useState('');
  const [target, setTarget] = useState('');

  useEffect(() => {
    const token = sessionStorage.getItem('clickup_token') || localStorage.getItem('clickup_token');
    if (!token) { router.push('/'); return; }
    sessionStorage.setItem('clickup_token', token);
    fetch('/api/clickup/workspaces', {
      headers: { Authorization: token },
    })
      .then(async (res) => {
        if (res.status === 401) { router.push('/'); return; }
        if (!res.ok) throw new Error('Failed to load workspaces');
        return res.json();
      })
      .then((data) => { if (data) setWorkspaces(data); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [router]);

  const canProceed = source && target && source !== target;

  function handleProceed() {
    router.push(`/migrate?source=${source}&target=${target}`);
  }

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

      <main className="flex-1 max-w-3xl mx-auto w-full px-6 py-12">
        <h1 className="text-2xl font-bold text-white mb-1">Select Workspaces</h1>
        <p className="text-gray-500 text-sm mb-8">Choose a source and destination workspace to begin migration.</p>

        {loading && (
          <div className="flex items-center gap-3 text-gray-400">
            <div className="w-5 h-5 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
            Loading your workspaces…
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-400 text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {!loading && !error && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8">
              {/* Source */}
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-3">
                  Source Workspace
                  <span className="ml-1 text-gray-600 font-normal">(copy from)</span>
                </label>
                <div className="space-y-2">
                  {workspaces.map((ws) => (
                    <WorkspaceCard
                      key={ws.id}
                      workspace={ws}
                      selected={source === ws.id}
                      disabled={target === ws.id}
                      onClick={() => setSource(ws.id)}
                    />
                  ))}
                </div>
              </div>

              {/* Target */}
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-3">
                  Destination Workspace
                  <span className="ml-1 text-gray-600 font-normal">(copy to)</span>
                </label>
                <div className="space-y-2">
                  {workspaces.map((ws) => (
                    <WorkspaceCard
                      key={ws.id}
                      workspace={ws}
                      selected={target === ws.id}
                      disabled={source === ws.id}
                      onClick={() => setTarget(ws.id)}
                    />
                  ))}
                </div>
              </div>
            </div>

            {source === target && source !== '' && (
              <p className="text-amber-400 text-sm mb-4 flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4" />
                Source and destination must be different workspaces.
              </p>
            )}

            <button
              onClick={handleProceed}
              disabled={!canProceed}
              className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 disabled:bg-gray-800 disabled:text-gray-600 text-white font-semibold px-6 py-3 rounded-xl transition-colors disabled:cursor-not-allowed"
            >
              Configure Migration
              <ArrowRight className="w-4 h-4" />
            </button>
          </>
        )}
      </main>
    </div>
  );
}

function WorkspaceCard({
  workspace,
  selected,
  disabled,
  onClick,
}: {
  workspace: ClickUpWorkspace;
  selected: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-full flex items-center gap-3 p-3.5 rounded-xl border text-left transition-all ${
        selected
          ? 'border-violet-500 bg-violet-500/10 text-white'
          : disabled
          ? 'border-gray-800 bg-gray-900/30 text-gray-600 cursor-not-allowed opacity-50'
          : 'border-gray-800 bg-gray-900 text-gray-300 hover:border-gray-600 hover:text-white'
      }`}
    >
      {/* Avatar */}
      {workspace.avatar ? (
        <img src={workspace.avatar} alt={workspace.name} className="w-8 h-8 rounded-lg flex-shrink-0 object-cover" />
      ) : (
        <div
          className="w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center text-white text-xs font-bold"
          style={{ backgroundColor: workspace.color || '#7c3aed' }}
        >
          {workspace.name.charAt(0).toUpperCase()}
        </div>
      )}
      <div className="min-w-0">
        <p className="font-medium text-sm truncate">{workspace.name}</p>
        <p className="text-xs text-gray-600 flex items-center gap-1 mt-0.5">
          <Users className="w-3 h-3" />
          {workspace.members?.length ?? 0} members
        </p>
      </div>
      {selected && (
        <div className="ml-auto w-2 h-2 rounded-full bg-violet-400 flex-shrink-0" />
      )}
    </button>
  );
}
