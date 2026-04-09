import axios from 'axios';
import type {
  ClickUpWorkspace, ClickUpSpace, ClickUpFolder,
  ClickUpList, ClickUpTask, ClickUpCustomField, TokenData
} from './types';

const BASE = 'https://api.clickup.com/api/v2';

export function createClient(token: string) {
  const client = axios.create({
    baseURL: BASE,
    headers: { Authorization: token },
  });

  return {
    // ── Auth ────────────────────────────────────────────────
    async exchangeCode(code: string): Promise<TokenData> {
      const res = await axios.post(`${BASE}/oauth/token`, null, {
        params: {
          client_id: process.env.CLICKUP_CLIENT_ID,
          client_secret: process.env.CLICKUP_CLIENT_SECRET,
          code,
        },
      });
      return res.data;
    },

    // ── User ───────────────────────────────────────────────
    async getUser(): Promise<{ id: number; username: string; email: string }> {
      const res = await client.get('/user');
      return res.data.user;
    },

    // ── Workspaces ──────────────────────────────────────────
    async getWorkspaces(): Promise<ClickUpWorkspace[]> {
      const res = await client.get('/team');
      return res.data.teams;
    },

    // ── Spaces ──────────────────────────────────────────────
    async getSpaces(workspaceId: string): Promise<ClickUpSpace[]> {
      const res = await client.get(`/team/${workspaceId}/space`, { params: { archived: false } });
      return res.data.spaces;
    },

    async createSpace(workspaceId: string, name: string, statuses: unknown[]): Promise<ClickUpSpace> {
      const res = await client.post(`/team/${workspaceId}/space`, { name, multiple_assignees: true, features: { due_dates: { enabled: true }, time_tracking: { enabled: false }, tags: { enabled: true }, time_estimates: { enabled: true }, checklists: { enabled: true }, custom_fields: { enabled: true }, remap_dependencies: { enabled: true }, dependency_warning: { enabled: true }, portfolios: { enabled: true } }, statuses });
      return res.data;
    },

    // ── Folders ─────────────────────────────────────────────
    async getFolders(spaceId: string): Promise<ClickUpFolder[]> {
      const res = await client.get(`/space/${spaceId}/folder`, { params: { archived: false } });
      return res.data.folders;
    },

    async createFolder(spaceId: string, name: string): Promise<ClickUpFolder> {
      const res = await client.post(`/space/${spaceId}/folder`, { name });
      return res.data;
    },

    // ── Lists ───────────────────────────────────────────────
    async getLists(folderId: string): Promise<ClickUpList[]> {
      const res = await client.get(`/folder/${folderId}/list`, { params: { archived: false } });
      return res.data.lists;
    },

    async getFolderlessLists(spaceId: string): Promise<ClickUpList[]> {
      const res = await client.get(`/space/${spaceId}/list`, { params: { archived: false } });
      return res.data.lists;
    },

    async getList(listId: string): Promise<ClickUpList> {
      const res = await client.get(`/list/${listId}`);
      return res.data;
    },

    async createList(folderId: string, name: string, statuses?: unknown[]): Promise<ClickUpList> {
      const res = await client.post(`/folder/${folderId}/list`, { name, ...(statuses ? { statuses } : {}) });
      return res.data;
    },

    async createFolderlessList(spaceId: string, name: string, statuses?: unknown[]): Promise<ClickUpList> {
      const res = await client.post(`/space/${spaceId}/list`, { name, ...(statuses ? { statuses } : {}) });
      return res.data;
    },

    // ── Custom Fields ────────────────────────────────────────
    async getCustomFields(listId: string): Promise<ClickUpCustomField[]> {
      const res = await client.get(`/list/${listId}/field`);
      return res.data.fields;
    },

    // ── Tasks ────────────────────────────────────────────────
    async getTasks(listId: string, page = 0): Promise<ClickUpTask[]> {
      const res = await client.get(`/list/${listId}/task`, {
        params: { page, subtasks: true, include_closed: true, include_attachments: true },
      });
      return res.data.tasks;
    },

    async getAllTasks(listId: string): Promise<ClickUpTask[]> {
      const all: ClickUpTask[] = [];
      let page = 0;
      while (true) {
        const tasks = await this.getTasks(listId, page);
        if (tasks.length === 0) break;
        all.push(...tasks);
        if (tasks.length < 100) break;
        page++;
      }
      return all;
    },

    async createTask(listId: string, payload: Partial<ClickUpTask> & { name: string }): Promise<ClickUpTask> {
      const res = await client.post(`/list/${listId}/task`, payload);
      return res.data;
    },

    async getTask(taskId: string): Promise<ClickUpTask> {
      const res = await client.get(`/task/${taskId}`, {
        params: { include_markdown_description: true },
      });
      return res.data;
    },

    async updateTask(taskId: string, payload: Partial<ClickUpTask>): Promise<ClickUpTask> {
      const res = await client.put(`/task/${taskId}`, payload);
      return res.data;
    },

    async setCustomFieldValue(taskId: string, fieldId: string, value: unknown): Promise<void> {
      await client.post(`/task/${taskId}/field/${fieldId}`, { value });
    },

    async copyAttachment(taskId: string, url: string, filename: string, mimetype: string): Promise<void> {
      // Download the file (try without auth first — ClickUp CDN URLs are often pre-signed)
      let fileData: ArrayBuffer;
      try {
        const dlRes = await fetch(url);
        if (!dlRes.ok) throw new Error(`Download failed: ${dlRes.status}`);
        fileData = await dlRes.arrayBuffer();
      } catch {
        // Retry with auth header
        const dlRes = await fetch(url, { headers: { Authorization: token } });
        if (!dlRes.ok) throw new Error(`Download with auth failed: ${dlRes.status}`);
        fileData = await dlRes.arrayBuffer();
      }

      // Upload using native fetch + FormData (reliable in Node 18+)
      const form = new FormData();
      form.append('attachment', new Blob([fileData], { type: mimetype }), filename);
      const uploadRes = await fetch(`${BASE}/task/${taskId}/attachment`, {
        method: 'POST',
        headers: { Authorization: token },
        body: form,
      });
      if (!uploadRes.ok) {
        const body = await uploadRes.text();
        throw new Error(`Upload failed ${uploadRes.status}: ${body}`);
      }
    },
  };
}

export async function exchangeCodeForToken(code: string): Promise<TokenData> {
  const res = await axios.post(`${BASE}/oauth/token`, null, {
    params: {
      client_id: process.env.CLICKUP_CLIENT_ID,
      client_secret: process.env.CLICKUP_CLIENT_SECRET,
      code,
    },
  });
  return res.data;
}
