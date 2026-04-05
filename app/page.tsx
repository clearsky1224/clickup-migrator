'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();
  const [token, setToken] = useState('');
  const [show, setShow] = useState(false);
  const [remember, setRemember] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const saved = localStorage.getItem('clickup_token');
    if (saved) {
      setToken(saved);
      setRemember(true);
    }
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: token.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Failed to connect'); return; }
      sessionStorage.setItem('clickup_token', token.trim());
      if (remember) {
        localStorage.setItem('clickup_token', token.trim());
      } else {
        localStorage.removeItem('clickup_token');
      }
      router.push('/dashboard');
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      <nav className="border-b border-gray-800 px-6 py-4 flex items-center gap-2">
        <span className="font-semibold text-white text-lg">⟳ ClickUp Migrator</span>
      </nav>

      <main className="flex-1 flex flex-col items-center justify-center px-6 py-16">
        <div className="w-full max-w-md">
          <h1 className="text-3xl font-bold text-white mb-2 text-center">Connect to ClickUp</h1>
          <p className="text-gray-500 text-sm text-center mb-8">Enter your Personal API Token to get started.</p>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="relative">
              <input
                type={show ? 'text' : 'password'}
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="pk_xxxxxxxxxxxxxxxxxx"
                className="w-full bg-gray-900 border border-gray-700 focus:border-violet-500 outline-none rounded-xl px-4 py-3 pr-12 text-white placeholder-gray-600 text-sm font-mono"
                autoComplete="off"
                spellCheck={false}
              />
              <button
                type="button"
                onClick={() => setShow(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white text-xs px-1"
              >
                {show ? 'hide' : 'show'}
              </button>
            </div>

            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <div
                onClick={() => setRemember(v => !v)}
                className={`w-9 h-5 rounded-full transition-colors flex-shrink-0 relative ${remember ? 'bg-violet-600' : 'bg-gray-700'}`}
              >
                <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${remember ? 'translate-x-4' : 'translate-x-0.5'}`} />
              </div>
              <span className="text-sm text-gray-400">Remember API token</span>
            </label>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-400 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !token.trim()}
              style={{ opacity: (!token.trim() || loading) ? 0.4 : 1 }}
              className="w-full bg-violet-600 hover:bg-violet-500 text-white font-semibold py-3 rounded-xl transition-colors cursor-pointer disabled:cursor-not-allowed"
            >
              {loading ? 'Verifying…' : 'Connect to ClickUp →'}
            </button>
          </form>

          <div className="mt-5 bg-gray-900 border border-gray-800 rounded-xl p-4">
            <p className="text-xs text-gray-500 font-medium mb-2">How to get your token:</p>
            <ol className="text-xs text-gray-600 space-y-1 list-decimal list-inside leading-relaxed">
              <li>Open ClickUp → click your avatar (top-right)</li>
              <li>Go to Settings → ClickUp API</li>
              <li>Copy your Personal API Token (starts with pk_)</li>
            </ol>
          </div>
        </div>
      </main>
    </div>
  );
}
