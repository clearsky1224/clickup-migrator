import { NextRequest, NextResponse } from 'next/server';
import type { InvoiceClient, InvoiceTask, TaskType, InvoiceSettings } from '@/lib/types';
import { TASK_TYPE_RATES } from '@/lib/types';

// Generates a CSV that Google Sheets can open directly
// Also returns a structured JSON for client-side rendering

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      month: string;
      clients: InvoiceClient[];
      settings: InvoiceSettings;
      format: 'csv' | 'json';
      uploadToDrive?: boolean;
      driveAccessToken?: string;
    };

    const { month, clients, settings, format, uploadToDrive, driveAccessToken } = body;

    if (format === 'csv') {
      const rows: string[][] = [];

      // Header row
      rows.push([`Invoice Sheet — ${month}`]);
      rows.push([`Freelancer: ${settings.myName}`, '', `Email: ${settings.myEmail}`]);
      rows.push([]);

      let grandTotal = 0;

      for (const client of clients) {
        rows.push([]); // spacer
        rows.push([client.name]); // client header

        // column headers
        rows.push(['Task ID', 'Task Name', 'Description', 'Date', 'Task Type', 'Qty', 'Hrs', 'ClickUp URL', 'Status', 'Price (USD)']);

        let subtotal = 0;
        for (const task of client.tasks) {
          rows.push([
            task.taskId,
            task.name,
            task.desc,
            task.date,
            task.taskType,
            String(task.qty ?? ''),
            String(task.hrs ?? ''),
            task.url,
            task.status,
            task.price.toFixed(2),
          ]);
          subtotal += task.price;
        }
        grandTotal += subtotal;
        rows.push(['', '', '', '', '', '', '', '', 'SUBTOTAL', subtotal.toFixed(2)]);
      }

      rows.push([]);
      rows.push(['', '', '', '', '', '', '', '', 'GRAND TOTAL', grandTotal.toFixed(2)]);

      // Convert to CSV string
      const csv = rows
        .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
        .join('\r\n');

      // If uploadToDrive is requested and we have an access token, upload to Google Drive
      let driveFileId: string | undefined;
      let driveFileName: string | undefined;
      
      if (uploadToDrive && driveAccessToken) {
        try {
          const fileName = `Invoice-${month.replace(/\s/g, '-')}.csv`;
          const metadata = {
            name: fileName,
            mimeType: 'text/csv',
          };

          const form = new FormData();
          form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
          form.append('file', new Blob([csv], { type: 'text/csv' }));

          const uploadResp = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
            method: 'POST',
            headers: { Authorization: `Bearer ${driveAccessToken}` },
            body: form,
          });

          if (uploadResp.ok) {
            const driveFile = await uploadResp.json();
            driveFileId = driveFile.id;
            driveFileName = fileName;
          } else {
            console.error('Drive upload failed:', uploadResp.status, await uploadResp.text());
          }
        } catch (driveError) {
          console.error('Drive upload error:', driveError);
        }
      }

      // Always return CSV data for client-side download
      return NextResponse.json({ 
        csvData: csv,
        driveFileId,
        driveFileName,
      });
    }

    // JSON format — for client-side sheet generation
    return NextResponse.json({ month, clients });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
