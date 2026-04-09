'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  FileText, Settings, LogOut, Plus, Trash2,
  RefreshCw, ChevronDown, ChevronRight, FolderOpen,
  List, Loader2, AlertCircle, CheckCircle2, ExternalLink,
  FileSpreadsheet, FileDown, X, Check,
  Copy, Clipboard, MoreHorizontal, ArrowUp, ArrowDown, Calendar
} from 'lucide-react';
import type {
  InvoiceClient, InvoiceTask, InvoiceSettings,
  TaskType
} from '@/lib/types';
import {
  TASK_TYPES, TASK_STATUSES, TASK_TYPE_RATES,
  DEFAULT_INVOICE_SETTINGS
} from '@/lib/types';

// ─── Helpers ─────────────────────────────────────────────────────────────────
function calcPrice(task: InvoiceTask): number {
  const type = task.taskType as TaskType;
  if (!type || !(type in TASK_TYPE_RATES)) return 0;
  const rate = TASK_TYPE_RATES[type];
  if (type === 'Hourly') return rate * (typeof task.hrs === 'number' ? task.hrs : 0);
  if (type === 'Fixed Price') return task.price; // Keep manually entered price
  if (type === 'N/A / Free') return 0;
  return rate * (typeof task.qty === 'number' ? task.qty : 0);
}

function fmt(n: number, currency: string = 'USD') {
  return n.toLocaleString('en-US', { style: 'currency', currency });
}

function convertPrice(usdPrice: number, exchangeRate: number): number {
  const rate = !exchangeRate || isNaN(exchangeRate) ? 1 : exchangeRate;
  return usdPrice * rate;
}

function newTask(): InvoiceTask {
  return {
    id: crypto.randomUUID(), taskId: '', name: '', desc: '',
    date: new Date().toISOString().split('T')[0],
    taskType: '', qty: '', hrs: '', url: '', status: '', price: 0,
  };
}

// ─── Main Page ───────────────────────────────────────────────────────────────
export default function InvoicePage() {
  const router = useRouter();
  const [settings, setSettings] = useState<InvoiceSettings>(DEFAULT_INVOICE_SETTINGS);
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return d.toLocaleString('en-US', { month: 'long', year: 'numeric' });
  });
  const [clients, setClients] = useState<InvoiceClient[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [importError, setImportError] = useState('');
  const [showImportModal, setShowImportModal] = useState(false);
  const [showAddClient, setShowAddClient] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [exporting, setExporting] = useState(false);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [copiedTasks, setCopiedTasks] = useState<InvoiceTask[]>([]);
  const [notification, setNotification] = useState('');

  useEffect(() => {
    const token = sessionStorage.getItem('clickup_token') || localStorage.getItem('clickup_token');
    if (!token) { router.push('/'); return; }
    const saved = localStorage.getItem('invoice_data');
    if (saved) {
      try {
        const p = JSON.parse(saved);
        if (p.month) setMonth(p.month);
        if (p.clients) setClients(p.clients);
      } catch { /* ignore */ }
    }
    const savedS = localStorage.getItem('invoice_settings');
    if (savedS) { 
      try { 
        const parsed = JSON.parse(savedS);
        // Ensure exchangeRate is a valid number
        if (!parsed.exchangeRate || isNaN(parsed.exchangeRate)) {
          parsed.exchangeRate = 1;
        }
        if (!parsed.currency) {
          parsed.currency = 'USD';
        }
        setSettings(parsed);
      } catch { /* ignore */ } 
    }
  }, [router]);

  useEffect(() => {
    localStorage.setItem('invoice_data', JSON.stringify({ month, clients }));
  }, [month, clients]);

  function notify(msg: string) {
    setNotification(msg);
    setTimeout(() => setNotification(''), 2500);
  }

  // ── Client ops ──────────────────────────────────────────────────────────────
  function toggleClient(name: string) {
    setExpanded(prev => { const n = new Set(prev); n.has(name) ? n.delete(name) : n.add(name); return n; });
  }
  function collapseAll() { setExpanded(new Set()); }
  function expandAll()   { setExpanded(new Set(clients.map(c => c.name))); }

  function addClient() {
    const name = newClientName.trim().toUpperCase();
    if (!name || clients.find(c => c.name === name)) return;
    setClients(prev => [...prev, { name, tasks: [] }]);
    setExpanded(prev => new Set([...prev, name]));
    setNewClientName('');
    setShowAddClient(false);
  }

  function removeClient(name: string) {
    if (!confirm(`Remove "${name}" and all their tasks?`)) return;
    setClients(prev => prev.filter(c => c.name !== name));
  }

  function moveClient(name: string, dir: -1 | 1) {
    setClients(prev => {
      const idx = prev.findIndex(c => c.name === name);
      if (idx < 0) return prev;
      const next = [...prev];
      const swap = idx + dir;
      if (swap < 0 || swap >= next.length) return prev;
      [next[idx], next[swap]] = [next[swap], next[idx]];
      return next;
    });
  }

  // ── Task ops ────────────────────────────────────────────────────────────────
  function addTask(clientName: string, atIndex?: number) {
    const task = newTask();
    setClients(prev => prev.map(c => {
      if (c.name !== clientName) return c;
      const tasks = [...c.tasks];
      if (atIndex !== undefined) tasks.splice(atIndex + 1, 0, task);
      else tasks.push(task);
      return { ...c, tasks };
    }));
    return task.id;
  }

  function duplicateTask(clientName: string, taskId: string) {
    setClients(prev => prev.map(c => {
      if (c.name !== clientName) return c;
      const idx = c.tasks.findIndex(t => t.id === taskId);
      if (idx < 0) return c;
      const copy = { ...c.tasks[idx], id: crypto.randomUUID(), taskId: '' };
      const tasks = [...c.tasks];
      tasks.splice(idx + 1, 0, copy);
      return { ...c, tasks };
    }));
    notify('Row duplicated');
  }

  function updateClient(clientName: string, updates: Partial<InvoiceClient>) {
    setClients(prev => prev.map(c => 
      c.name === clientName ? { ...c, ...updates } : c
    ));
  }

  function updateTask(clientName: string, taskId: string, updates: Partial<InvoiceTask>) {
    setClients(prev => prev.map(c => {
      if (c.name !== clientName) return c;
      return { ...c, tasks: c.tasks.map(t => {
        if (t.id !== taskId) return t;
        const u = { ...t, ...updates };
        u.price = calcPrice(u);
        return u;
      })};
    }));
  }

  function removeTask(clientName: string, taskId: string) {
    setClients(prev => prev.map(c =>
      c.name === clientName ? { ...c, tasks: c.tasks.filter(t => t.id !== taskId) } : c
    ));
    setSelectedRows(prev => { const n = new Set(prev); n.delete(taskId); return n; });
  }

  function moveTask(clientName: string, taskId: string, dir: -1 | 1) {
    setClients(prev => prev.map(c => {
      if (c.name !== clientName) return c;
      const tasks = [...c.tasks];
      const idx = tasks.findIndex(t => t.id === taskId);
      const swap = idx + dir;
      if (idx < 0 || swap < 0 || swap >= tasks.length) return c;
      [tasks[idx], tasks[swap]] = [tasks[swap], tasks[idx]];
      return { ...c, tasks };
    }));
  }

  function deleteSelectedRows() {
    if (selectedRows.size === 0) return;
    if (!confirm(`Delete ${selectedRows.size} selected row(s)?`)) return;
    setClients(prev => prev.map(c => ({ ...c, tasks: c.tasks.filter(t => !selectedRows.has(t.id)) })));
    setSelectedRows(new Set());
    notify(`${selectedRows.size} row(s) deleted`);
  }

  function copySelectedRows() {
    const all: InvoiceTask[] = clients.flatMap(c => c.tasks.filter(t => selectedRows.has(t.id)));
    setCopiedTasks(all);
    notify(`${all.length} row(s) copied`);
  }

  function pasteRows(clientName: string) {
    if (copiedTasks.length === 0) return;
    const pasted = copiedTasks.map(t => ({ ...t, id: crypto.randomUUID(), taskId: '' }));
    setClients(prev => prev.map(c =>
      c.name === clientName ? { ...c, tasks: [...c.tasks, ...pasted] } : c
    ));
    notify(`${pasted.length} row(s) pasted into ${clientName}`);
  }

  function toggleRowSelect(taskId: string) {
    setSelectedRows(prev => { const n = new Set(prev); n.has(taskId) ? n.delete(taskId) : n.add(taskId); return n; });
  }

  function selectAllInClient(clientName: string) {
    const client = clients.find(c => c.name === clientName);
    if (!client) return;
    const ids = client.tasks.map(t => t.id);
    const allSelected = ids.every(id => selectedRows.has(id));
    setSelectedRows(prev => {
      const n = new Set(prev);
      if (allSelected) ids.forEach(id => n.delete(id));
      else ids.forEach(id => n.add(id));
      return n;
    });
  }

  // ── Import / Export ─────────────────────────────────────────────────────────
  function handleImportDone(imported: Record<string, InvoiceTask[]>) {
    setShowImportModal(false);
    if (Object.keys(imported).length === 0) return;
    setClients(prev => {
      const next = [...prev];
      for (const [clientName, tasks] of Object.entries(imported)) {
        const existing = next.find(c => c.name === clientName);
        if (existing) {
          const existingIds = new Set(existing.tasks.map(t => t.taskId).filter(Boolean));
          existing.tasks = [...existing.tasks, ...tasks.filter(t => !existingIds.has(t.taskId))];
        } else {
          next.push({ name: clientName, tasks });
        }
      }
      return next;
    });
    setExpanded(prev => new Set([...prev, ...Object.keys(imported)]));
    const count = Object.values(imported).reduce((s, t) => s + t.length, 0);
    notify(`${count} task(s) imported`);
  }

  async function getGoogleDriveToken(): Promise<string | null> {
    return new Promise((resolve) => {
      // Check if we have a cached token
      const cached = sessionStorage.getItem('google_drive_token');
      const expiry = sessionStorage.getItem('google_drive_token_expiry');
      if (cached && expiry && Date.now() < parseInt(expiry)) {
        resolve(cached);
        return;
      }

      // Use Google OAuth2 implicit flow
      const clientId = settings.googleDriveClientId;
      if (!clientId) {
        notify('⚠️ Google Drive Client ID not configured. Go to Settings to add it.');
        resolve(null);
        return;
      }

      const redirectUri = window.location.origin + '/invoice';
      const scope = 'https://www.googleapis.com/auth/drive.file';
      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=token&scope=${scope}`;

      const popup = window.open(authUrl, 'Google Drive Auth', 'width=500,height=600');
      
      const checkPopup = setInterval(() => {
        try {
          if (popup && popup.location.href.includes('access_token=')) {
            const hash = popup.location.hash.substring(1);
            const params = new URLSearchParams(hash);
            const accessToken = params.get('access_token');
            const expiresIn = params.get('expires_in');
            
            if (accessToken) {
              sessionStorage.setItem('google_drive_token', accessToken);
              if (expiresIn) {
                sessionStorage.setItem('google_drive_token_expiry', String(Date.now() + parseInt(expiresIn) * 1000));
              }
              popup.close();
              clearInterval(checkPopup);
              resolve(accessToken);
            }
          }
          if (popup && popup.closed) {
            clearInterval(checkPopup);
            resolve(null);
          }
        } catch (e) {
          // Cross-origin error expected until redirect
        }
      }, 500);
    });
  }

  async function exportCSV() {
    setExporting(true);
    try {
      // Get Google Drive access token
      const driveToken = await getGoogleDriveToken();
      
      const token = sessionStorage.getItem('clickup_token') || localStorage.getItem('clickup_token') || '';
      const resp = await fetch('/api/invoice/export-sheets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: token },
        body: JSON.stringify({ 
          month, clients, settings, format: 'csv', 
          uploadToDrive: !!driveToken,
          driveAccessToken: driveToken || undefined,
        }),
      });
      if (!resp.ok) throw new Error('Export failed');
      const result = await resp.json();
      
      // Download locally
      if (result.csvData) {
        const blob = new Blob([result.csvData], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `Invoice-${month.replace(/\s/g, '-')}.csv`; a.click();
        URL.revokeObjectURL(url);
      }
      
      // Show success message
      if (result.driveFileId) {
        notify(`✓ CSV downloaded & uploaded to Google Drive`);
      } else {
        notify('CSV downloaded — open in Google Sheets or Excel');
      }
    } catch (e) { setImportError(String(e)); }
    finally { setExporting(false); }
  }

  function exportPDF() {
    const data = encodeURIComponent(JSON.stringify({ month, clients, settings }));
    window.open(`/invoice/preview?data=${data}`, '_blank');
  }

  function clearSheet() {
    if (!confirm('Clear ALL clients and tasks? This cannot be undone.')) return;
    setClients([]);
    setSelectedRows(new Set());
    notify('Sheet cleared');
  }

  const grandTotal = clients.reduce((s, c) => s + c.tasks.reduce((ts, t) => ts + t.price, 0), 0);
  const totalTasks  = clients.reduce((s, c) => s + c.tasks.length, 0);

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">

      {/* ── Top Nav ─────────────────────────────────────────────────────────── */}
      <nav className="border-b border-gray-800 px-6 py-3 flex items-center justify-between sticky top-0 z-30 bg-gray-950/95 backdrop-blur">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-violet-400" />
            <span className="font-semibold text-white">Invoice Manager</span>
          </div>
          <div className="flex items-center gap-0.5 bg-gray-900 border border-gray-800 rounded-lg p-0.5">
            <a href="/dashboard" className="px-3 py-1.5 text-xs text-gray-400 hover:text-white rounded-md transition-colors">Migration</a>
            <span className="px-3 py-1.5 text-xs text-white bg-gray-800 rounded-md font-medium">Invoices</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <a href="/invoice/settings" className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-white transition-colors">
            <Settings className="w-3.5 h-3.5" />Settings
          </a>
          <a href="/api/auth/logout" className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-white transition-colors">
            <LogOut className="w-3.5 h-3.5" />Disconnect
          </a>
        </div>
      </nav>

      {/* ── Toolbar ─────────────────────────────────────────────────────────── */}
      <div className="border-b border-gray-800 bg-gray-900/60 px-4 py-2 flex items-center gap-1 flex-wrap sticky top-[53px] z-20">
        {/* Month */}
        <input
          type="text" value={month} onChange={e => setMonth(e.target.value)}
          className="bg-gray-800 border border-gray-700 text-white text-xs rounded px-2 py-1.5 outline-none focus:border-violet-500 w-32 mr-2"
          placeholder="Month"
        />
        <div className="w-px h-5 bg-gray-700 mx-1" />

        {/* Import */}
        <ToolBtn icon={<RefreshCw className="w-3.5 h-3.5" />} label="Import from ClickUp" onClick={() => setShowImportModal(true)} accent />

        <div className="w-px h-5 bg-gray-700 mx-1" />

        {/* Add client */}
        <ToolBtn icon={<Plus className="w-3.5 h-3.5" />} label="Add Client" onClick={() => setShowAddClient(true)} />

        <div className="w-px h-5 bg-gray-700 mx-1" />

        {/* Selection actions */}
        <ToolBtn icon={<Copy className="w-3.5 h-3.5" />} label="Copy rows" onClick={copySelectedRows} disabled={selectedRows.size === 0} />
        <ToolBtn icon={<Trash2 className="w-3.5 h-3.5" />} label="Delete rows" onClick={deleteSelectedRows} disabled={selectedRows.size === 0} danger />

        <div className="w-px h-5 bg-gray-700 mx-1" />

        {/* Expand/collapse */}
        <ToolBtn icon={<ChevronDown className="w-3.5 h-3.5" />} label="Expand all" onClick={expandAll} />
        <ToolBtn icon={<ChevronRight className="w-3.5 h-3.5" />} label="Collapse all" onClick={collapseAll} />

        <div className="w-px h-5 bg-gray-700 mx-1" />

        {/* Export */}
        <ToolBtn icon={<FileSpreadsheet className="w-3.5 h-3.5" />} label={exporting ? 'Exporting…' : 'Export CSV'} onClick={exportCSV} disabled={exporting || clients.length === 0} />
        <ToolBtn icon={<FileDown className="w-3.5 h-3.5" />} label="Preview PDF" onClick={exportPDF} disabled={clients.length === 0} />

        <div className="w-px h-5 bg-gray-700 mx-1" />

        {/* Clear */}
        <ToolBtn icon={<Trash2 className="w-3.5 h-3.5" />} label="Clear sheet" onClick={clearSheet} disabled={clients.length === 0} danger />

        {/* Stats */}
        <div className="ml-auto flex items-center gap-4 text-xs text-gray-500">
          {selectedRows.size > 0 && <span className="text-violet-400">{selectedRows.size} selected</span>}
          <span>{clients.length} client{clients.length !== 1 ? 's' : ''}</span>
          <span>{totalTasks} task{totalTasks !== 1 ? 's' : ''}</span>
          <span className="text-white font-bold">{fmt(convertPrice(grandTotal, settings.exchangeRate), settings.currency)}</span>
        </div>
      </div>

      {/* ── Notifications ────────────────────────────────────────────────────── */}
      {notification && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 bg-gray-800 border border-gray-700 text-white text-xs px-4 py-2.5 rounded-full shadow-xl flex items-center gap-2">
          <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />{notification}
        </div>
      )}
      {importError && (
        <div className="mx-4 mt-3 flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-400 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />{importError}
          <button onClick={() => setImportError('')} className="ml-auto"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* ── Sheet body ──────────────────────────────────────────────────────── */}
      <main className="flex-1 px-4 py-4 space-y-3 overflow-x-auto">
        {clients.length === 0 && (
          <div className="text-center py-20 text-gray-600">
            <FileText className="w-14 h-14 mx-auto mb-4 opacity-20" />
            <p className="text-base font-medium text-gray-500 mb-1">Sheet is empty</p>
            <p className="text-sm">Click <strong className="text-gray-400">Import from ClickUp</strong> or <strong className="text-gray-400">Add Client</strong> to begin</p>
          </div>
        )}

        {clients.map((client, clientIdx) => {
          const subtotal    = client.tasks.reduce((s, t) => s + t.price, 0);
          const isExpanded  = expanded.has(client.name);
          const allSelected = client.tasks.length > 0 && client.tasks.every(t => selectedRows.has(t.id));

          return (
            <div key={client.name} className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">

              {/* ── Client header bar ─────────────────────────────────────── */}
              <div className="flex items-center gap-2 px-3 py-2.5 bg-gray-800/70 select-none">
                {/* Checkbox — selects all tasks */}
                <input
                  type="checkbox" checked={allSelected} onChange={() => selectAllInClient(client.name)}
                  className="w-3.5 h-3.5 accent-violet-500 cursor-pointer flex-shrink-0"
                />
                <button onClick={() => toggleClient(client.name)} className="flex items-center gap-2 flex-1 min-w-0 text-left">
                  {isExpanded
                    ? <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    : <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />}
                  <span className="font-bold text-white text-sm tracking-wide truncate">{client.name}</span>
                  <span className="text-xs text-gray-500 flex-shrink-0">{client.tasks.length} row{client.tasks.length !== 1 ? 's' : ''}</span>
                </button>
                <span className="text-white font-bold text-sm tabular-nums flex-shrink-0">{fmt(convertPrice(subtotal, settings.exchangeRate), settings.currency)}</span>

                {/* Client action buttons */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  <IconBtn title="Move up"      icon={<ArrowUp className="w-3 h-3" />}    onClick={() => moveClient(client.name, -1)} disabled={clientIdx === 0} />
                  <IconBtn title="Move down"    icon={<ArrowDown className="w-3 h-3" />}  onClick={() => moveClient(client.name, 1)} disabled={clientIdx === clients.length - 1} />
                  {copiedTasks.length > 0 && (
                    <IconBtn title={`Paste ${copiedTasks.length} row(s)`} icon={<Clipboard className="w-3 h-3" />} onClick={() => pasteRows(client.name)} />
                  )}
                  <IconBtn title="Add row"    icon={<Plus className="w-3 h-3" />}   onClick={() => addTask(client.name)} accent />
                  <IconBtn title="Delete client" icon={<Trash2 className="w-3 h-3" />} onClick={() => removeClient(client.name)} danger />
                </div>
              </div>

              {/* ── Client details (email, address) ───────────────────────── */}
              {isExpanded && (
                <div className="px-4 py-3 bg-gray-800/30 border-b border-gray-800/60 grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] text-gray-600 uppercase tracking-wider mb-1">Client Email</label>
                    <input
                      type="email"
                      value={client.email || ''}
                      onChange={e => updateClient(client.name, { email: e.target.value })}
                      placeholder="client@example.com"
                      className="w-full bg-gray-800 border border-gray-700 text-white text-xs rounded px-2.5 py-1.5 outline-none focus:border-violet-500 transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-gray-600 uppercase tracking-wider mb-1">Client Address</label>
                    <input
                      type="text"
                      value={client.address || ''}
                      onChange={e => updateClient(client.name, { address: e.target.value })}
                      placeholder="City, Country"
                      className="w-full bg-gray-800 border border-gray-700 text-white text-xs rounded px-2.5 py-1.5 outline-none focus:border-violet-500 transition-colors"
                    />
                  </div>
                </div>
              )}

              {/* ── Spreadsheet table ──────────────────────────────────────── */}
              {isExpanded && (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs border-collapse" style={{ minWidth: 900 }}>
                    <thead>
                      <tr className="bg-gray-800/40 text-gray-500 uppercase tracking-wider text-[10px]">
                        <th className="w-8 px-2 py-2 text-center border-b border-gray-800">#</th>
                        <th className="w-6 px-1 py-2 border-b border-gray-800"></th>
                        <th className="text-left px-3 py-2 font-medium border-b border-gray-800" style={{minWidth:200}}>Task Name</th>
                        <th className="text-left px-3 py-2 font-medium border-b border-gray-800" style={{minWidth:160}}>Description</th>
                        <th className="text-left px-3 py-2 font-medium border-b border-gray-800" style={{minWidth:180}}>ClickUp URL</th>
                        <th className="text-left px-3 py-2 font-medium border-b border-gray-800 w-28">Date</th>
                        <th className="text-left px-3 py-2 font-medium border-b border-gray-800 w-32">Task Type</th>
                        <th className="text-center px-3 py-2 font-medium border-b border-gray-800 w-14">Qty</th>
                        <th className="text-center px-3 py-2 font-medium border-b border-gray-800 w-14">Hrs</th>
                        <th className="text-left px-3 py-2 font-medium border-b border-gray-800 w-28">Status</th>
                        <th className="text-right px-3 py-2 font-medium border-b border-gray-800 w-24">Price</th>
                        <th className="w-16 px-2 py-2 border-b border-gray-800"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {client.tasks.length === 0 && (
                        <tr>
                          <td colSpan={11} className="text-center py-8 text-gray-700 italic">
                            No rows — click <strong className="text-gray-500 not-italic">+ Add row</strong> or import from ClickUp
                          </td>
                        </tr>
                      )}
                      {client.tasks.map((task, rowIdx) => (
                        <SheetRow
                          key={task.id}
                          task={task}
                          rowNum={rowIdx + 1}
                          selected={selectedRows.has(task.id)}
                          onSelect={() => toggleRowSelect(task.id)}
                          onChange={u => updateTask(client.name, task.id, u)}
                          onRemove={() => removeTask(client.name, task.id)}
                          onDuplicate={() => duplicateTask(client.name, task.id)}
                          onInsertBelow={() => addTask(client.name, rowIdx)}
                          onMoveUp={() => moveTask(client.name, task.id, -1)}
                          onMoveDown={() => moveTask(client.name, task.id, 1)}
                          isFirst={rowIdx === 0}
                          isLast={rowIdx === client.tasks.length - 1}
                          settings={settings}
                        />
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-gray-800/30 border-t border-gray-700">
                        <td colSpan={9} className="px-3 py-2 text-right text-gray-400 font-semibold text-xs uppercase tracking-wider">Subtotal</td>
                        <td className="px-3 py-2 text-right text-white font-bold tabular-nums">{fmt(convertPrice(subtotal, settings.exchangeRate), settings.currency)}</td>
                        <td />
                      </tr>
                      {/* Add row footer button */}
                      <tr className="border-t border-gray-800/50">
                        <td colSpan={11} className="px-3 py-1.5">
                          <button
                            onClick={() => addTask(client.name)}
                            className="flex items-center gap-1.5 text-xs text-gray-600 hover:text-violet-400 transition-colors"
                          >
                            <Plus className="w-3 h-3" />Add row
                          </button>
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          );
        })}

        {/* Grand total */}
        {clients.length > 0 && (
          <div className="flex justify-end pt-2 pb-4">
            <div className="bg-gradient-to-r from-violet-900/50 to-violet-800/30 border border-violet-700/40 rounded-xl px-6 py-3 flex items-center gap-8">
              <span className="text-gray-400 text-sm font-medium">Grand Total — {month}</span>
              <span className="text-white text-2xl font-bold tabular-nums">{fmt(convertPrice(grandTotal, settings.exchangeRate), settings.currency)}</span>
            </div>
          </div>
        )}
      </main>

      {/* ── Add client modal ─────────────────────────────────────────────────── */}
      {showAddClient && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h2 className="text-white font-semibold mb-4">Add New Client</h2>
            <input
              type="text" value={newClientName} onChange={e => setNewClientName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addClient()}
              placeholder="CLIENT NAME (e.g. WHILE IN AFRICA)"
              className="w-full bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2.5 outline-none focus:border-violet-500 mb-4"
              autoFocus
            />
            <div className="flex gap-2">
              <button onClick={addClient} className="flex-1 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium py-2.5 rounded-lg transition-colors">Add Client</button>
              <button onClick={() => setShowAddClient(false)} className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium py-2.5 rounded-lg transition-colors">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Import modal ────────────────────────────────────────────────────── */}
      {showImportModal && (
        <ImportModal settings={settings} onDone={handleImportDone} onClose={() => setShowImportModal(false)} />
      )}
    </div>
  );
}

// ─── Toolbar button ──────────────────────────────────────────────────────────
function ToolBtn({ icon, label, onClick, disabled, accent, danger }: {
  icon: React.ReactNode; label: string; onClick: () => void;
  disabled?: boolean; accent?: boolean; danger?: boolean;
}) {
  return (
    <button
      onClick={onClick} disabled={disabled} title={label}
      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium transition-colors disabled:opacity-30 disabled:cursor-not-allowed
        ${accent ? 'bg-violet-600 hover:bg-violet-500 text-white'
        : danger ? 'text-gray-500 hover:text-red-400 hover:bg-red-400/10'
        : 'text-gray-400 hover:text-white hover:bg-gray-700'}`}
    >
      {icon}<span className="hidden sm:inline">{label}</span>
    </button>
  );
}

// ─── Icon-only button (compact) ──────────────────────────────────────────────
function IconBtn({ icon, title, onClick, disabled, accent, danger }: {
  icon: React.ReactNode; title: string; onClick: () => void;
  disabled?: boolean; accent?: boolean; danger?: boolean;
}) {
  return (
    <button
      onClick={onClick} disabled={disabled} title={title}
      className={`p-1 rounded transition-colors disabled:opacity-25 disabled:cursor-not-allowed
        ${accent ? 'text-violet-400 hover:text-violet-300 hover:bg-violet-400/10'
        : danger ? 'text-gray-600 hover:text-red-400 hover:bg-red-400/10'
        : 'text-gray-500 hover:text-white hover:bg-gray-700'}`}
    >
      {icon}
    </button>
  );
}

// ─── Sheet Row (spreadsheet cell editing) ────────────────────────────────────
function SheetRow({
  task, rowNum, selected, onSelect, onChange, onRemove,
  onDuplicate, onInsertBelow, onMoveUp, onMoveDown, isFirst, isLast, settings,
}: {
  task: InvoiceTask; rowNum: number; selected: boolean;
  onSelect: () => void;
  onChange: (u: Partial<InvoiceTask>) => void;
  onRemove: () => void; onDuplicate: () => void; onInsertBelow: () => void;
  onMoveUp: () => void; onMoveDown: () => void;
  isFirst: boolean; isLast: boolean;
  settings: InvoiceSettings;
}) {
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on outside click
  useEffect(() => {
    if (!showMenu) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowMenu(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showMenu]);

  const rowBg = selected ? 'bg-violet-500/10' : 'hover:bg-gray-800/40';

  return (
    <tr className={`border-b border-gray-800/60 group ${rowBg} transition-colors`}>
      {/* Row number */}
      <td className="px-2 py-1 text-center text-gray-600 select-none w-8">{rowNum}</td>

      {/* Checkbox */}
      <td className="px-1 py-1 w-6">
        <input type="checkbox" checked={selected} onChange={onSelect}
          className="w-3.5 h-3.5 accent-violet-500 cursor-pointer" />
      </td>

      {/* Task Name */}
      <td className="px-0 py-0">
        <CellInput
          value={task.name} onChange={v => onChange({ name: v })}
          placeholder="Task name" className="text-white font-medium"
        />
      </td>

      {/* Description (from custom field) */}
      <td className="px-0 py-0">
        <CellInput
          value={task.desc} onChange={v => onChange({ desc: v })}
          placeholder="Description" className="text-gray-400"
        />
      </td>

      {/* ClickUp URL */}
      <td className="px-0 py-0">
        <div className="flex items-center">
          <CellInput
            value={task.url} onChange={v => onChange({ url: v })}
            placeholder="https://app.clickup.com/t/..." className="text-blue-400 text-[11px] flex-1"
          />
          {task.url && (
            <a href={task.url} target="_blank" rel="noopener noreferrer"
              className="text-gray-600 hover:text-violet-400 px-1.5 flex-shrink-0" title="Open in ClickUp">
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      </td>

      {/* Date */}
      <td className="px-0 py-0 w-28 relative">
        <input type="date" value={task.date} onChange={e => onChange({ date: e.target.value })}
          className="w-full bg-transparent text-white text-xs px-3 py-2 outline-none focus:bg-gray-800/60 border-r border-gray-800/0 focus:border-violet-500/50 rounded transition-colors [color-scheme:dark]" />
      </td>

      {/* Task Type */}
      <td className="px-1 py-1 w-32">
        <select value={task.taskType} onChange={e => onChange({ taskType: e.target.value as TaskType })}
          className="w-full bg-transparent text-white text-xs px-2 py-1.5 outline-none focus:bg-gray-800 rounded border border-transparent focus:border-violet-500/50 cursor-pointer transition-colors">
          <option value="">— Type —</option>
          {TASK_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </td>

      {/* Qty */}
      <td className="px-0 py-0 w-14">
        <input type="number" value={task.qty === '' ? '' : task.qty}
          onChange={e => onChange({ qty: e.target.value === '' ? '' : parseFloat(e.target.value) })}
          placeholder="—" min={0}
          className="w-full bg-transparent text-gray-300 text-xs px-3 py-2 outline-none text-center focus:bg-gray-800/60 rounded transition-colors" />
      </td>

      {/* Hrs */}
      <td className="px-0 py-0 w-14">
        <input type="number" value={task.hrs === '' ? '' : task.hrs}
          onChange={e => onChange({ hrs: e.target.value === '' ? '' : parseFloat(e.target.value) })}
          placeholder="—" min={0} step={0.5}
          className="w-full bg-transparent text-gray-300 text-xs px-3 py-2 outline-none text-center focus:bg-gray-800/60 rounded transition-colors" />
      </td>

      {/* Status */}
      <td className="px-1 py-1 w-28">
        <select value={task.status} onChange={e => onChange({ status: e.target.value })}
          className="w-full bg-transparent text-gray-400 text-xs px-2 py-1.5 outline-none focus:bg-gray-800 rounded border border-transparent focus:border-violet-500/50 cursor-pointer transition-colors">
          <option value="">— Status —</option>
          {TASK_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </td>

      {/* Price */}
      <td className="px-0 py-0 w-24">
        {task.taskType === 'Fixed Price' ? (
          <input
            type="number"
            value={task.price === 0 ? '' : task.price}
            onChange={e => onChange({ price: e.target.value === '' ? 0 : parseFloat(e.target.value) })}
            placeholder="0.00"
            min={0}
            step={0.01}
            className="w-full bg-transparent text-white text-xs px-3 py-2 outline-none text-right focus:bg-gray-800/60 rounded transition-colors font-semibold tabular-nums"
          />
        ) : (
          <div className="px-3 py-2 text-right text-white font-semibold tabular-nums select-none">
            {fmt(convertPrice(task.price, settings.exchangeRate), settings.currency)}
          </div>
        )}
      </td>

      {/* Row actions */}
      <td className="px-1.5 py-1 w-16">
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity relative">
          <IconBtn title="Move up"   icon={<ArrowUp className="w-3 h-3" />}   onClick={onMoveUp}   disabled={isFirst} />
          <IconBtn title="Move down" icon={<ArrowDown className="w-3 h-3" />} onClick={onMoveDown} disabled={isLast} />
          <div className="relative" ref={menuRef}>
            <IconBtn title="More" icon={<MoreHorizontal className="w-3 h-3" />} onClick={() => setShowMenu(v => !v)} />
            {showMenu && (
              <div className="absolute right-0 top-6 z-50 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl py-1 w-44">
                <MenuItem icon={<Copy className="w-3.5 h-3.5" />}    label="Duplicate row"    onClick={() => { onDuplicate(); setShowMenu(false); }} />
                <MenuItem icon={<Plus className="w-3.5 h-3.5" />}    label="Insert row below" onClick={() => { onInsertBelow(); setShowMenu(false); }} />
                {task.url && (
                  <MenuItem icon={<ExternalLink className="w-3.5 h-3.5" />} label="Open in ClickUp"
                    onClick={() => { window.open(task.url, '_blank'); setShowMenu(false); }} />
                )}
                <div className="border-t border-gray-800 my-1" />
                <MenuItem icon={<Trash2 className="w-3.5 h-3.5" />}  label="Delete row"       onClick={() => { onRemove(); setShowMenu(false); }} danger />
              </div>
            )}
          </div>
        </div>
      </td>
    </tr>
  );
}

// ─── Inline cell input ───────────────────────────────────────────────────────
function CellInput({ value, onChange, placeholder, className = '' }: {
  value: string; onChange: (v: string) => void; placeholder?: string; className?: string;
}) {
  return (
    <input
      value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
      className={`w-full bg-transparent text-xs px-3 py-2 outline-none focus:bg-gray-800/60 rounded transition-colors placeholder-gray-700 focus:placeholder-gray-600 ${className}`}
    />
  );
}

// ─── Context menu item ───────────────────────────────────────────────────────
function MenuItem({ icon, label, onClick, danger }: {
  icon: React.ReactNode; label: string; onClick: () => void; danger?: boolean;
}) {
  return (
    <button onClick={onClick}
      className={`w-full flex items-center gap-2.5 px-3 py-1.5 text-xs transition-colors ${danger ? 'text-red-400 hover:bg-red-400/10' : 'text-gray-300 hover:bg-gray-800 hover:text-white'}`}>
      {icon}{label}
    </button>
  );
}

// ─── Import Modal ─────────────────────────────────────────────────────────────
function ImportModal({
  settings,
  onDone,
  onClose,
}: {
  settings: InvoiceSettings;
  onDone: (tasks: Record<string, InvoiceTask[]>) => void;
  onClose: () => void;
}) {
  type Step = 'workspace' | 'space' | 'folder' | 'list' | 'importing';

  const [step, setStep] = useState<Step>('workspace');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [workspaces, setWorkspaces] = useState<{ id: string; name: string }[]>([]);
  const [spaces, setSpaces] = useState<{ id: string; name: string }[]>([]);
  const [folders, setFolders] = useState<{ id: string; name: string; lists: { id: string; name: string; task_count: number }[] }[]>([]);
  const [folderlessLists, setFolderlessLists] = useState<{ id: string; name: string; task_count: number }[]>([]);
  const [selectedWorkspace, setSelectedWorkspace] = useState<{ id: string; name: string } | null>(null);
  const [selectedSpace, setSelectedSpace] = useState<{ id: string; name: string } | null>(null);
  const [selectedFolder, setSelectedFolder] = useState<{ id: string; name: string } | null>(null);
  const [selectedListIds, setSelectedListIds] = useState<Set<string>>(new Set());
  const [availableLists, setAvailableLists] = useState<{ id: string; name: string; task_count: number }[]>([]);
  const [importResult, setImportResult] = useState<{ total: number; skipped: number; clients: Record<string, InvoiceTask[]> } | null>(null);

  const token = sessionStorage.getItem('clickup_token') || localStorage.getItem('clickup_token') || '';

  useEffect(() => {
    setLoading(true);
    fetch('/api/clickup/workspaces', { headers: { Authorization: token } })
      .then(r => r.json())
      .then(workspaces => {
        setWorkspaces(workspaces.map((ws: { id: string; name: string }) => ({ id: ws.id, name: ws.name })));
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [token]);

  async function selectWorkspace(workspace: { id: string; name: string }) {
    setSelectedWorkspace(workspace);
    setLoading(true);
    setError('');
    try {
      const r = await fetch(`/api/clickup/spaces/${workspace.id}`, { headers: { Authorization: token } });
      const data = await r.json();
      if (Array.isArray(data)) {
        setSpaces(data.map((s: { id: string; name: string }) => ({ id: s.id, name: s.name })));
        setStep('space');
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  async function selectSpace(space: { id: string; name: string }) {
    setSelectedSpace(space);
    setLoading(true);
    setError('');
    try {
      const [foldersResp, listsResp] = await Promise.all([
        fetch(`https://api.clickup.com/api/v2/space/${space.id}/folder?archived=false`, { headers: { Authorization: token } }),
        fetch(`https://api.clickup.com/api/v2/space/${space.id}/list?archived=false`, { headers: { Authorization: token } }),
      ]);
      const foldersData = await foldersResp.json();
      const listsData = await listsResp.json();
      setFolders(foldersData.folders || []);
      setFolderlessLists(listsData.lists || []);
      setStep('folder');
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  function selectFolder(folder: { id: string; name: string; lists: { id: string; name: string; task_count: number }[] } | null) {
    if (folder === null) {
      // No folder - use folderless lists
      setAvailableLists(folderlessLists);
      setSelectedFolder(null);
    } else {
      setSelectedFolder(folder);
      setAvailableLists(folder.lists);
    }
    setSelectedListIds(new Set());
    setStep('list');
  }

  function toggleList(id: string) {
    setSelectedListIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function runImport() {
    if (selectedListIds.size === 0) return;
    setStep('importing');
    setLoading(true);
    setError('');
    try {
      const resp = await fetch('/api/invoice/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: token },
        body: JSON.stringify({ listIds: [...selectedListIds], fieldMap: settings.fieldMap }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'Import failed');
      setImportResult({ total: data.total, skipped: data.skipped, clients: data.tasksByClient });
    } catch (e) {
      setError(String(e));
      setStep('list');
    } finally {
      setLoading(false);
    }
  }

  function confirmImport() {
    if (importResult) onDone(importResult.clients);
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg max-h-[80vh] flex flex-col">
        {/* Modal header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800 flex-shrink-0">
          <div>
            <h2 className="text-white font-semibold">Import from ClickUp</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {step === 'workspace' && 'Step 1: Select a workspace'}
              {step === 'space' && `Step 2: Select a space in "${selectedWorkspace?.name}"`}
              {step === 'folder' && `Step 3: Select a folder in "${selectedSpace?.name}"`}
              {step === 'list' && `Step 4: Select list(s) to import`}
              {step === 'importing' && 'Importing tasks…'}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 min-h-0">
          {loading && (
            <div className="flex items-center justify-center py-10 gap-2 text-gray-400">
              <Loader2 className="w-5 h-5 animate-spin text-violet-400" />
              Loading…
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-400 text-sm mb-4">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* Step: Workspace */}
          {!loading && step === 'workspace' && (
            <div className="space-y-2">
              {workspaces.map(ws => (
                <button
                  key={ws.id}
                  onClick={() => selectWorkspace(ws)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl border border-gray-800 bg-gray-800/40 hover:border-violet-500/50 hover:bg-violet-500/5 text-left transition-all"
                >
                  <div className="w-8 h-8 rounded-lg bg-violet-900/50 flex items-center justify-center text-violet-300 text-xs font-bold flex-shrink-0">
                    {ws.name.charAt(0)}
                  </div>
                  <span className="text-white text-sm font-medium">{ws.name}</span>
                  <ChevronRight className="w-4 h-4 text-gray-600 ml-auto" />
                </button>
              ))}
            </div>
          )}

          {/* Step: Space */}
          {!loading && step === 'space' && (
            <div className="space-y-2">
              {spaces.map(s => (
                <button
                  key={s.id}
                  onClick={() => selectSpace(s)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl border border-gray-800 bg-gray-800/40 hover:border-violet-500/50 hover:bg-violet-500/5 text-left transition-all"
                >
                  <div className="w-8 h-8 rounded-lg bg-violet-900/50 flex items-center justify-center text-violet-300 text-xs font-bold flex-shrink-0">
                    {s.name.charAt(0)}
                  </div>
                  <span className="text-white text-sm font-medium">{s.name}</span>
                  <ChevronRight className="w-4 h-4 text-gray-600 ml-auto" />
                </button>
              ))}
              <button
                onClick={() => setStep('workspace')}
                className="text-xs text-gray-600 hover:text-gray-400 mt-2 transition-colors"
              >
                ← Back to workspaces
              </button>
            </div>
          )}

          {/* Step: Folder */}
          {!loading && step === 'folder' && (
            <div className="space-y-2">
              <button
                onClick={() => selectFolder(null)}
                disabled={folderlessLists.length === 0}
                className="w-full flex items-center gap-3 p-3 rounded-xl border border-gray-800 bg-gray-800/40 hover:border-violet-500/50 hover:bg-violet-500/5 text-left transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <List className="w-4 h-4 text-gray-500 flex-shrink-0" />
                <span className="text-gray-300 text-sm">[No Folder] — {folderlessLists.length} list{folderlessLists.length !== 1 ? 's' : ''}</span>
                <ChevronRight className="w-4 h-4 text-gray-600 ml-auto" />
              </button>
              {folders.map(f => (
                <button
                  key={f.id}
                  onClick={() => selectFolder(f)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl border border-gray-800 bg-gray-800/40 hover:border-violet-500/50 hover:bg-violet-500/5 text-left transition-all"
                >
                  <FolderOpen className="w-4 h-4 text-gray-500 flex-shrink-0" />
                  <span className="text-white text-sm font-medium">{f.name}</span>
                  <span className="text-xs text-gray-600 ml-auto">{f.lists.length} lists</span>
                  <ChevronRight className="w-4 h-4 text-gray-600" />
                </button>
              ))}
              <button
                onClick={() => setStep('space')}
                className="text-xs text-gray-600 hover:text-gray-400 mt-2 transition-colors"
              >
                ← Back to spaces
              </button>
            </div>
          )}

          {/* Step: List */}
          {!loading && step === 'list' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-500">{selectedListIds.size} selected</span>
                <button
                  onClick={() => setSelectedListIds(
                    selectedListIds.size === availableLists.length
                      ? new Set()
                      : new Set(availableLists.map(l => l.id))
                  )}
                  className="text-xs text-violet-400 hover:text-violet-300"
                >
                  {selectedListIds.size === availableLists.length ? 'Deselect all' : 'Select all'}
                </button>
              </div>
              {availableLists.map(l => (
                <button
                  key={l.id}
                  onClick={() => toggleList(l.id)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${
                    selectedListIds.has(l.id)
                      ? 'border-violet-500/50 bg-violet-500/10 text-white'
                      : 'border-gray-800 bg-gray-800/40 text-gray-300 hover:border-gray-700'
                  }`}
                >
                  <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${selectedListIds.has(l.id) ? 'border-violet-400 bg-violet-500' : 'border-gray-600'}`}>
                    {selectedListIds.has(l.id) && <Check className="w-2.5 h-2.5 text-white" />}
                  </div>
                  <List className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />
                  <span className="text-sm font-medium">{l.name}</span>
                  <span className="text-xs text-gray-600 ml-auto">{l.task_count ?? 0} tasks</span>
                </button>
              ))}
              <button
                onClick={() => setStep('folder')}
                className="text-xs text-gray-600 hover:text-gray-400 mt-2 transition-colors"
              >
                ← Back to folders
              </button>
            </div>
          )}

          {/* Step: Result */}
          {!loading && step === 'importing' && importResult && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-green-400">
                <CheckCircle2 className="w-5 h-5" />
                <span className="font-medium">Import complete!</span>
              </div>
              <div className="bg-gray-800/50 rounded-xl p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Total tasks found</span>
                  <span className="text-white font-medium">{importResult.total}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Skipped (not Ready / no Client)</span>
                  <span className="text-amber-400 font-medium">{importResult.skipped}</span>
                </div>
                <div className="flex justify-between border-t border-gray-700 pt-2">
                  <span className="text-gray-400">Tasks to import</span>
                  <span className="text-green-400 font-bold">
                    {Object.values(importResult.clients).reduce((s, t) => s + t.length, 0)}
                  </span>
                </div>
              </div>
              {Object.entries(importResult.clients).map(([client, tasks]) => (
                <div key={client} className="bg-gray-800/30 rounded-lg px-3 py-2 flex justify-between text-sm">
                  <span className="text-white font-medium">{client}</span>
                  <span className="text-violet-400">{tasks.length} task{tasks.length !== 1 ? 's' : ''}</span>
                </div>
              ))}
              {Object.keys(importResult.clients).length === 0 && (
                <div className="text-amber-400 text-sm bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3">
                  No tasks matched the filter criteria.<br />
                  Tasks need "Invoice Status = Ready" and a "Client" custom field.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal footer */}
        <div className="flex gap-2 px-5 py-4 border-t border-gray-800 flex-shrink-0">
          {step === 'list' && (
            <button
              onClick={runImport}
              disabled={selectedListIds.size === 0}
              className="flex-1 bg-violet-600 hover:bg-violet-500 disabled:bg-gray-800 disabled:text-gray-600 text-white font-medium text-sm py-2.5 rounded-lg transition-colors"
            >
              Import {selectedListIds.size > 0 ? `from ${selectedListIds.size} list${selectedListIds.size > 1 ? 's' : ''}` : ''}
            </button>
          )}
          {step === 'importing' && importResult && (
            <button
              onClick={confirmImport}
              disabled={Object.keys(importResult.clients).length === 0}
              className="flex-1 bg-violet-600 hover:bg-violet-500 disabled:bg-gray-800 disabled:text-gray-600 text-white font-medium text-sm py-2.5 rounded-lg transition-colors"
            >
              Add to Invoice Sheet
            </button>
          )}
          <button
            onClick={onClose}
            className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 font-medium text-sm py-2.5 rounded-lg transition-colors"
          >
            {step === 'importing' && importResult ? 'Dismiss' : 'Cancel'}
          </button>
        </div>
      </div>
    </div>
  );
}
