'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Settings, ArrowLeft, Save, CheckCircle2, RefreshCw, LogOut } from 'lucide-react';
import type { InvoiceSettings } from '@/lib/types';
import { DEFAULT_INVOICE_SETTINGS } from '@/lib/types';

export default function InvoiceSettingsPage() {
  const router = useRouter();
  const [settings, setSettings] = useState<InvoiceSettings>(DEFAULT_INVOICE_SETTINGS);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const token = sessionStorage.getItem('clickup_token') || localStorage.getItem('clickup_token');
    if (!token) { router.push('/'); return; }
    const s = localStorage.getItem('invoice_settings');
    if (s) {
      try { setSettings(JSON.parse(s)); } catch { /* ignore */ }
    }
  }, [router]);

  function save() {
    localStorage.setItem('invoice_settings', JSON.stringify(settings));
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  function update(key: keyof InvoiceSettings, value: string | number) {
    setSettings(prev => ({ ...prev, [key]: value }));
  }

  function updateField(key: keyof InvoiceSettings['fieldMap'], value: string) {
    setSettings(prev => ({ ...prev, fieldMap: { ...prev.fieldMap, [key]: value } }));
  }

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      <nav className="border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <RefreshCw className="w-5 h-5 text-violet-400" />
            <span className="font-semibold text-white text-lg">ClickUp Migrator</span>
          </div>
        </div>
        <a href="/api/auth/logout" className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-white transition-colors">
          <LogOut className="w-4 h-4" />
          Disconnect
        </a>
      </nav>

      <main className="flex-1 max-w-2xl mx-auto w-full px-6 py-8">
        <button
          onClick={() => router.push('/invoice')}
          className="flex items-center gap-1.5 text-gray-500 hover:text-white text-sm mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Invoice Manager
        </button>

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Invoice Settings</h1>
            <p className="text-gray-500 text-sm mt-0.5">Configure your details and ClickUp field mapping</p>
          </div>
          <button
            onClick={save}
            className="flex items-center gap-1.5 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            {saved ? <><CheckCircle2 className="w-4 h-4" />Saved!</> : <><Save className="w-4 h-4" />Save Settings</>}
          </button>
        </div>

        <div className="space-y-6">
          {/* Personal Details */}
          <section className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-white mb-4">Your Details</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Full Name</label>
                <input
                  value={settings.myName}
                  onChange={e => update('myName', e.target.value)}
                  placeholder="e.g. Paul Jezreel S. Bondad"
                  className="w-full bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2.5 outline-none focus:border-violet-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Email Address</label>
                <input
                  type="email"
                  value={settings.myEmail}
                  onChange={e => update('myEmail', e.target.value)}
                  placeholder="e.g. you@example.com"
                  className="w-full bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2.5 outline-none focus:border-violet-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Payment Details <span className="text-gray-600">(shown on invoice)</span></label>
                <textarea
                  value={settings.myPayment}
                  onChange={e => update('myPayment', e.target.value)}
                  placeholder={'e.g. BDO Savings Account\nAccount Name: Your Name\nAccount Number: 1234 5678 9012\n\nWise: you@example.com'}
                  rows={5}
                  className="w-full bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2.5 outline-none focus:border-violet-500 resize-none font-mono"
                />
              </div>
            </div>
          </section>

          {/* Google Drive Integration */}
          <section className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-white mb-1">Google Drive Integration</h2>
            <p className="text-xs text-gray-500 mb-4">
              Configure Google OAuth to automatically upload CSV exports to your Google Drive.
            </p>
            <div>
              <label className="block text-xs text-gray-500 mb-1">
                Google OAuth Client ID <span className="text-gray-600">(optional)</span>
              </label>
              <input
                value={settings.googleDriveClientId}
                onChange={e => update('googleDriveClientId', e.target.value)}
                placeholder="123456789-abcdefg.apps.googleusercontent.com"
                className="w-full bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2.5 outline-none focus:border-violet-500 font-mono"
              />
              <p className="text-xs text-gray-600 mt-2">
                Get your Client ID from <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer" className="text-violet-400 hover:text-violet-300 underline">Google Cloud Console</a>.
                Create an OAuth 2.0 Client ID with authorized redirect URI: <code className="bg-gray-800 px-1 rounded">{typeof window !== 'undefined' ? window.location.origin : ''}/invoice</code>
              </p>
            </div>
          </section>

          {/* Currency & Exchange Rate */}
          <section className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-white mb-1">Currency & Exchange Rate</h2>
            <p className="text-xs text-gray-500 mb-4">
              Set your preferred currency and exchange rate. Prices are calculated in USD and converted to your currency.
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Currency Code</label>
                <input
                  value={settings.currency}
                  onChange={e => update('currency', e.target.value.toUpperCase())}
                  placeholder="USD"
                  maxLength={3}
                  className="w-full bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2.5 outline-none focus:border-violet-500 uppercase"
                />
                <p className="text-xs text-gray-600 mt-1">e.g., USD, PHP, EUR, GBP</p>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Exchange Rate (from USD)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={settings.exchangeRate}
                  onChange={e => update('exchangeRate', parseFloat(e.target.value) || 1)}
                  placeholder="1.00"
                  className="w-full bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2.5 outline-none focus:border-violet-500"
                />
                <p className="text-xs text-gray-600 mt-1">1 USD = {settings.exchangeRate} {settings.currency}</p>
              </div>
            </div>
            <div className="mt-3 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
              <p className="text-xs text-blue-400">
                <strong>Example:</strong> For Philippine Peso (PHP), set Currency to "PHP" and Exchange Rate to "56.50" (current rate). 
                A $100 USD task will display as ₱5,650.00 PHP.
              </p>
            </div>
          </section>

          {/* ClickUp Field Mapping */}
          <section className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-white mb-1">ClickUp Custom Field Names</h2>
            <p className="text-xs text-gray-500 mb-4">
              Enter the exact names of your ClickUp custom fields (case-insensitive).
              These are used to map ClickUp task data to invoice columns.
            </p>
            <div className="space-y-3">
              {[
                { key: 'client' as const,   label: 'Client Field',           hint: 'Routes task to the correct client section',  placeholder: 'Client' },
                { key: 'taskType' as const, label: 'Task Type Field',         hint: 'Maps to pricing type (Regular Page, etc.)',  placeholder: 'Task Type' },
                { key: 'qty' as const,      label: 'Qty Field',               hint: 'Number of units for the task',               placeholder: 'Qty' },
                { key: 'date' as const,     label: 'Date Assigned Field',     hint: 'Date the task was assigned',                 placeholder: 'Date assigned' },
                { key: 'taskDesc' as const, label: 'Task Description Field',  hint: 'Custom description field (not the built-in task description)', placeholder: 'Task Description' },
              ].map(({ key, label, hint, placeholder }) => (
                <div key={key}>
                  <label className="block text-xs text-gray-400 mb-1">
                    {label}
                    <span className="text-gray-600 ml-1">— {hint}</span>
                  </label>
                  <input
                    value={settings.fieldMap[key]}
                    onChange={e => updateField(key, e.target.value)}
                    placeholder={placeholder}
                    className="w-full bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2.5 outline-none focus:border-violet-500 font-mono"
                  />
                </div>
              ))}
            </div>

            <div className="mt-4 bg-amber-500/10 border border-amber-500/20 rounded-lg px-4 py-3">
              <p className="text-amber-400 text-xs leading-relaxed">
                <strong>Note:</strong> The "Invoice Status" filter is always <code className="bg-amber-500/20 px-1 rounded">Ready</code> (case-insensitive).
                Tasks without this value will be skipped during import.
              </p>
            </div>
          </section>

          {/* Pricing Reference */}
          <section className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-white mb-1">Pricing Reference</h2>
            <p className="text-xs text-gray-500 mb-4">Current task type rates used for invoice calculations.</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                ['Regular Page', '$20 × Qty'],
                ['Dynamic Page', '$30 × Qty'],
                ['Lengthy Page', '$30 × Qty'],
                ['Blog / Tour',  '$15 × Qty'],
                ['Hourly',       '$7 × Hrs Tracked'],
                ['Fixed Price',  'Qty = Amount'],
                ['N/A / Free',   '$0'],
              ].map(([type, rate]) => (
                <div key={type} className="flex items-center justify-between bg-gray-800/50 rounded-lg px-3 py-2">
                  <span className="text-xs text-gray-300">{type}</span>
                  <span className="text-xs text-violet-400 font-mono">{rate}</span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
