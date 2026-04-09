import { NextRequest, NextResponse } from 'next/server';
import type { InvoiceTask, InvoiceSettings, TaskType, TASK_TYPE_RATES } from '@/lib/types';
import { TASK_TYPE_RATES as RATES } from '@/lib/types';

export async function POST(req: NextRequest) {
  const token = req.headers.get('Authorization');
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    const { listIds, fieldMap } = body as {
      listIds: string[];
      fieldMap: InvoiceSettings['fieldMap'];
    };

    if (!listIds || listIds.length === 0) {
      return NextResponse.json({ error: 'No list IDs provided' }, { status: 400 });
    }

    function getField(task: Record<string, unknown>, fieldName: string): string {
      if (!fieldName) return '';
      const fields = task.custom_fields as { name: string; value: unknown; type: string; type_config?: { options?: { orderindex: number; name: string }[] } }[] | undefined;
      if (!fields) return '';
      const f = fields.find(cf => cf.name.trim().toLowerCase() === fieldName.trim().toLowerCase());
      if (!f || f.value === null || f.value === undefined) return '';
      if (f.type === 'drop_down' && f.type_config?.options) {
        const opt = f.type_config.options.find(o => o.orderindex === f.value);
        return opt ? opt.name : '';
      }
      return String(f.value);
    }

    const tasksByClient: Record<string, InvoiceTask[]> = {};
    let skipped = 0;
    let total = 0;

    for (const listId of listIds) {
      let page = 0;
      while (true) {
        const resp = await fetch(
          `https://api.clickup.com/api/v2/list/${listId}/task?archived=false&subtasks=true&page=${page}`,
          { headers: { Authorization: token } }
        );

        if (!resp.ok) break;

        const data = await resp.json() as { tasks: Record<string, unknown>[] };
        if (!data.tasks || data.tasks.length === 0) break;
        total += data.tasks.length;

        for (const task of data.tasks) {
          const invoiceStatus = getField(task, 'Invoice Status').trim().toLowerCase();
          if (invoiceStatus !== 'ready') { skipped++; continue; }

          const client = getField(task, fieldMap.client).trim().toUpperCase();
          if (!client) { skipped++; continue; }

          const taskType = getField(task, fieldMap.taskType) as TaskType | '';
          const qtyRaw = getField(task, fieldMap.qty);
          const qty = qtyRaw ? parseFloat(qtyRaw) : '';
          const dateRaw = getField(task, fieldMap.date);
          const dateCreated = task.date_created as string | undefined;
          let dateVal = '';
          if (dateRaw) dateVal = new Date(Number(dateRaw)).toISOString().split('T')[0];
          else if (dateCreated) dateVal = new Date(Number(dateCreated)).toISOString().split('T')[0];

          const ms = Number(task.time_spent) || 0;
          const hrs = ms > 0 ? Math.ceil((ms / 3600000) * 2) / 2 : '';

          // Calculate price
          let price = 0;
          if (taskType && taskType in RATES) {
            const rate = RATES[taskType as TaskType];
            if (taskType === 'Hourly') price = rate * (typeof hrs === 'number' ? hrs : 0);
            else if (taskType === 'Fixed Price') price = typeof qty === 'number' ? qty : 0;
            else if (taskType === 'N/A / Free') price = 0;
            else price = rate * (typeof qty === 'number' ? qty : 0);
          }

          const invoiceTask: InvoiceTask = {
            id:       crypto.randomUUID(),
            taskId:   task.id as string,
            name:     task.name as string || '',
            desc:     getField(task, fieldMap.taskDesc) || '', // Custom field, not built-in description
            date:     dateVal,
            taskType,
            qty,
            hrs,
            url:      task.url as string || '',
            status:   (task.status as { status: string } | null)?.status || '',
            price,
          };

          if (!tasksByClient[client]) tasksByClient[client] = [];
          tasksByClient[client].push(invoiceTask);
        }

        if (data.tasks.length < 100) break;
        page++;
      }
    }

    return NextResponse.json({ tasksByClient, total, skipped });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
