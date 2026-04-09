export interface ClickUpWorkspace {
  id: string;
  name: string;
  color: string;
  avatar: string | null;
  members: { user: { id: number; username: string; email: string } }[];
}

export interface ClickUpSpace {
  id: string;
  name: string;
  private: boolean;
  statuses: ClickUpStatus[];
  features: Record<string, unknown>;
}

export interface ClickUpFolder {
  id: string;
  name: string;
  lists: ClickUpList[];
}

export interface ClickUpList {
  id: string;
  name: string;
  folder: { id: string; name: string; hidden: boolean } | null;
  space: { id: string; name: string };
  task_count: number;
  statuses: ClickUpStatus[];
}

export interface ClickUpStatus {
  id?: string;
  status: string;
  color: string;
  type: string;
  orderindex: number;
}

export interface ClickUpCustomField {
  id: string;
  name: string;
  type: string;
  type_config: Record<string, unknown>;
  date_created: string;
  hide_from_guests: boolean;
  required: boolean;
}

export interface ClickUpTask {
  id: string;
  name: string;
  description?: string;
  markdown_description?: string;
  status: { status: string; color: string; type: string };
  priority: { id: string; priority: string; color: string; orderindex: string } | null;
  due_date: string | null;
  start_date: string | null;
  assignees: { id: number; username: string; email: string }[];
  tags: { name: string; tag_fg: string; tag_bg: string }[];
  custom_fields: { id: string; name: string; value: unknown; type: string }[];
  subtasks?: ClickUpTask[];
  checklists?: ClickUpChecklist[];
  attachments?: ClickUpAttachment[];
  parent: string | null;
}

export interface ClickUpAttachment {
  id: string;
  title: string;
  url: string;
  extension: string;
  mimetype: string;
  size: number;
}

export interface ClickUpChecklist {
  id: string;
  name: string;
  items: { id: string; name: string; resolved: boolean; orderindex: number }[];
}

export interface MigrationConfig {
  sourceWorkspaceId: string;
  targetWorkspaceId: string;
  targetSpaceId?: string;
  targetFolderId?: string;
  selectedLists: string[];
  options: {
    migrateTasks: boolean;
    migrateStatuses: boolean;
    migrateCustomFields: boolean;
    migrateSubtasks: boolean;
    migrateChecklists: boolean;
    migrateAssignees: boolean;
    migrateTags: boolean;
    migratePriority: boolean;
    migrateDates: boolean;
    migrateDescriptions: boolean;
    migrateAttachments: boolean;
    skipDuplicates: boolean;
    onlyMyTasks: boolean;
  };
}

export interface MigrationResult {
  listId: string;
  listName: string;
  status: 'pending' | 'running' | 'success' | 'error';
  tasksTotal: number;
  tasksMigrated: number;
  error?: string;
  newListId?: string;
  failedTasks?: { name: string; error: string }[];
}

export interface TokenData {
  access_token: string;
  token_type: string;
}

// ─── INVOICE TYPES ────────────────────────────────────────────────────────────

export type TaskType =
  | 'Regular Page'
  | 'Dynamic Page'
  | 'Lengthy Page'
  | 'Blog / Tour'
  | 'Hourly'
  | 'Fixed Price'
  | 'N/A / Free';

export const TASK_TYPE_RATES: Record<TaskType, number> = {
  'Regular Page': 20,
  'Dynamic Page': 30,
  'Lengthy Page': 30,
  'Blog / Tour':  15,
  'Hourly':        7,
  'Fixed Price':   0, // uses qty as the amount
  'N/A / Free':    0,
};

export const TASK_TYPES: TaskType[] = [
  'Regular Page', 'Dynamic Page', 'Lengthy Page',
  'Blog / Tour', 'Hourly', 'Fixed Price', 'N/A / Free',
];

export const TASK_STATUSES = [
  'Complete', 'Done', 'For QA', 'In Progress',
  'Live', 'Ready for Release', 'On Hold', 'Cancelled',
];

export interface InvoiceTask {
  id:        string;
  taskId:    string;   // ClickUp task ID (for dedup)
  name:      string;
  desc:      string;   // From custom field "Task Description", not built-in description
  date:      string;
  taskType:  TaskType | '';
  qty:       number | '';
  hrs:       number | '';
  url:       string;
  status:    string;
  price:     number;
}

export interface InvoiceClient {
  name:    string;
  contactName?: string;   // Contact person name
  email?:  string;
  address?: string;
  currency?: string;      // Client-specific currency (e.g., "PHP", "USD")
  exchangeRate?: number;  // Client-specific exchange rate from USD
  footnote?: string;      // Custom payment details or notes for this client
  tasks:   InvoiceTask[];
}

export interface InvoiceSheet {
  month:   string;       // e.g. "April 2026"
  invoiceNumber: string; // e.g. "JMC-20260410"
  clients: InvoiceClient[];
}

export interface InvoiceSettings {
  myName:    string;
  myEmail:   string;
  myPayment: string;
  paymentNotes: string; // Global payment notes/details for all invoices
  googleDriveClientId: string;
  currency:  string;  // e.g., 'USD', 'PHP', 'EUR'
  exchangeRate: number; // Conversion rate from USD to selected currency
  fieldMap: {
    taskType: string;
    qty:      string;
    date:     string;
    client:   string;
    taskDesc: string;
  };
}

export const DEFAULT_INVOICE_SETTINGS: InvoiceSettings = {
  myName:    '',
  myEmail:   '',
  myPayment: '',
  paymentNotes: '',
  googleDriveClientId: '',
  currency:  'USD',
  exchangeRate: 1,
  fieldMap: {
    taskType: 'Task Type',
    qty:      'Qty',
    date:     'Date assigned',
    client:   'Client',
    taskDesc: 'Task Description',
  },
};
