'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Printer, ArrowLeft } from 'lucide-react';
import type { InvoiceClient, InvoiceSettings } from '@/lib/types';
import { TASK_TYPE_RATES } from '@/lib/types';

function fmt(n: number, currency: string = 'USD') {
  return n.toLocaleString('en-US', { style: 'currency', currency });
}

function convertPrice(usdPrice: number, exchangeRate: number): number {
  const rate = !exchangeRate || isNaN(exchangeRate) ? 1 : exchangeRate;
  return usdPrice * rate;
}

function PreviewContent() {
  const searchParams = useSearchParams();
  const [month, setMonth] = useState('');
  const [clients, setClients] = useState<InvoiceClient[]>([]);
  const [settings, setSettings] = useState<InvoiceSettings | null>(null);

  useEffect(() => {
    // First try preview data (from PDF export button)
    const previewData = localStorage.getItem('invoice_preview_data');
    if (previewData) {
      try {
        const parsed = JSON.parse(previewData);
        setMonth(parsed.month || '');
        setClients(parsed.clients || []);
        setSettings(parsed.settings || null);
        // Clear it after reading to avoid stale data
        localStorage.removeItem('invoice_preview_data');
        return;
      } catch (e) {
        console.error('Failed to parse preview data:', e);
      }
    }
    
    // Fallback to URL parameter (legacy)
    const raw = searchParams.get('data');
    if (raw) {
      try {
        const parsed = JSON.parse(decodeURIComponent(raw));
        setMonth(parsed.month || '');
        setClients(parsed.clients || []);
        setSettings(parsed.settings || null);
      } catch { /* ignore */ }
    } else {
      // Final fallback to regular invoice data
      const saved = localStorage.getItem('invoice_data');
      const savedSettings = localStorage.getItem('invoice_settings');
      if (saved) {
        try {
          const p = JSON.parse(saved);
          setMonth(p.month || '');
          setClients(p.clients || []);
        } catch { /* ignore */ }
      }
      if (savedSettings) {
        try { setSettings(JSON.parse(savedSettings)); } catch { /* ignore */ }
      }
    }
  }, [searchParams]);

  const grandTotal = clients.reduce((s, c) => s + c.tasks.reduce((ts, t) => ts + t.price, 0), 0);
  const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Print toolbar — hidden when printing */}
      <div className="print:hidden bg-white border-b px-6 py-3 flex items-center gap-3 sticky top-0 z-10 shadow-sm">
        <a href="/invoice" className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Back
        </a>
        <span className="text-gray-300">|</span>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-1.5 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium px-4 py-1.5 rounded-lg transition-colors"
        >
          <Printer className="w-3.5 h-3.5" />
          Print / Save PDF
        </button>
        <span className="text-xs text-gray-400 ml-2">Use "Save as PDF" in the print dialog</span>
      </div>

      {/* Invoice document */}
      <div className="max-w-4xl mx-auto my-8 print:my-0 bg-white shadow-xl print:shadow-none p-10 print:p-8">
        {/* Header */}
        <div className="flex justify-between items-start mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">INVOICE</h1>
            <p className="text-gray-500 mt-1">{month}</p>
          </div>
          <div className="text-right">
            <p className="font-bold text-gray-900 text-lg">{settings?.myName || 'Freelancer'}</p>
            <p className="text-gray-500 text-sm">{settings?.myEmail || ''}</p>
            <p className="text-gray-400 text-xs mt-1">Date: {today}</p>
          </div>
        </div>

        <hr className="border-gray-200 mb-8" />

        {/* Client sections */}
        {clients.map((client) => {
          const subtotal = client.tasks.reduce((s, t) => s + t.price, 0);
          return (
            <div key={client.name} className="mb-10 page-break-inside-avoid">
              {/* Client header */}
              <div className="bg-gray-900 text-white px-4 py-2.5 rounded-t-lg">
                <h2 className="font-bold text-sm uppercase tracking-widest">{client.name}</h2>
                {(client.email || client.address) && (
                  <div className="mt-1.5 text-xs text-gray-400 space-y-0.5">
                    {client.email && <div>{client.email}</div>}
                    {client.address && <div>{client.address}</div>}
                  </div>
                )}
              </div>

              {/* Task table */}
              <table className="w-full text-sm border border-gray-200 border-t-0 rounded-b-lg overflow-hidden">
                <thead className="bg-gray-50">
                  <tr className="text-gray-500 text-xs uppercase tracking-wider">
                    <th className="text-left px-3 py-2 font-medium">Task</th>
                    <th className="text-left px-3 py-2 font-medium w-28">Type</th>
                    <th className="text-center px-3 py-2 font-medium w-16">Qty</th>
                    <th className="text-center px-3 py-2 font-medium w-16">Hrs</th>
                    <th className="text-right px-3 py-2 font-medium w-24">Price</th>
                  </tr>
                </thead>
                <tbody>
                  {client.tasks.map((task, i) => (
                    <tr key={task.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                      <td className="px-3 py-2.5 border-t border-gray-100">
                        <p className="font-medium text-gray-800">{task.name || '—'}</p>
                        {task.desc && <p className="text-xs text-gray-500 mt-0.5">{task.desc}</p>}
                        {task.url && (
                          <a 
                            href={task.url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-[10px] text-blue-600 hover:text-blue-800 underline mt-1 block break-all"
                          >
                            {task.url}
                          </a>
                        )}
                      </td>
                      <td className="px-3 py-2.5 border-t border-gray-100 text-gray-600 text-xs">
                        {task.taskType || '—'}
                      </td>
                      <td className="px-3 py-2.5 border-t border-gray-100 text-center text-gray-600 text-xs">
                        {task.qty !== '' ? task.qty : '—'}
                      </td>
                      <td className="px-3 py-2.5 border-t border-gray-100 text-center text-gray-600 text-xs">
                        {task.hrs !== '' ? task.hrs : '—'}
                      </td>
                      <td className="px-3 py-2.5 border-t border-gray-100 text-right font-mono font-medium text-gray-800">
                        {fmt(convertPrice(task.price, settings?.exchangeRate || 1), settings?.currency || 'USD')}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-900 text-white">
                    <td colSpan={4} className="px-3 py-2.5 text-right font-semibold text-sm">Subtotal</td>
                    <td className="px-3 py-2.5 text-right font-bold font-mono">{fmt(convertPrice(subtotal, settings?.exchangeRate || 1), settings?.currency || 'USD')}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          );
        })}

        {/* Grand total */}
        <div className="flex justify-end mt-4">
          <div className="bg-gray-900 text-white rounded-xl px-6 py-4 min-w-48">
            <div className="flex justify-between gap-8">
              <span className="text-gray-300 font-medium">GRAND TOTAL</span>
              <span className="font-bold text-xl font-mono">{fmt(convertPrice(grandTotal, settings?.exchangeRate || 1), settings?.currency || 'USD')}</span>
            </div>
          </div>
        </div>

        {/* Payment details */}
        {settings?.myPayment && (
          <div className="mt-10 border-t border-gray-200 pt-8">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Payment Details</h3>
            <pre className="text-sm text-gray-600 font-sans whitespace-pre-wrap leading-relaxed">
              {settings.myPayment}
            </pre>
          </div>
        )}

        {/* Footer */}
        <div className="mt-10 pt-6 border-t border-gray-100 text-center text-xs text-gray-400">
          Thank you for your business! — {settings?.myName} · {settings?.myEmail}
        </div>
      </div>

      <style>{`
        @media print {
          .page-break-inside-avoid { page-break-inside: avoid; }
        }
      `}</style>
    </div>
  );
}

export default function PreviewPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-100 flex items-center justify-center text-gray-500">Loading preview…</div>}>
      <PreviewContent />
    </Suspense>
  );
}
