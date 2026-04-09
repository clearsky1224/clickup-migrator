# Invoice Management System - Documentation

## Project Overview

A comprehensive invoice management system built into the ClickUp Migrator application. This system allows you to import tasks from ClickUp, organize them by client, apply pricing rules, and generate professional PDF invoices with multi-currency support.

**Last Updated:** April 10, 2026

---

## Table of Contents

1. [Features](#features)
2. [Tech Stack](#tech-stack)
3. [Project Structure](#project-structure)
4. [Data Models](#data-models)
5. [Key Features](#key-features)
6. [Usage Guide](#usage-guide)
7. [Configuration](#configuration)
8. [Multi-Currency Support](#multi-currency-support)
9. [PDF Export](#pdf-export)
10. [Troubleshooting](#troubleshooting)

---

## Features

### Core Functionality
- ✅ Import tasks from ClickUp filtered by "Invoice Status = Ready"
- ✅ Organize tasks by client automatically
- ✅ Multiple pricing models (Regular Page, Dynamic Page, Hourly, Fixed Price, etc.)
- ✅ Multi-currency support with custom exchange rates per client
- ✅ Professional PDF invoice generation
- ✅ Google Sheets CSV export
- ✅ Client-specific payment notes and global payment terms
- ✅ Invoice numbering system (JMC-YYYYMMDD format)
- ✅ Contact name per client
- ✅ Multi-line text support for task names, descriptions, and URLs

### Advanced Features
- ✅ Per-client currency and exchange rate
- ✅ Per-currency grand total breakdown
- ✅ Client selection for PDF export (one or multiple)
- ✅ Auto-resizing textareas for multi-line input
- ✅ Editable prices for Fixed Price tasks
- ✅ Task duplication, copy/paste, and bulk operations
- ✅ Persistent data storage in localStorage
- ✅ Google Drive integration for CSV uploads

---

## Tech Stack

- **Framework:** Next.js 15 (App Router)
- **UI Library:** React 19
- **Styling:** TailwindCSS 4
- **Language:** TypeScript
- **Icons:** Lucide React
- **Storage:** localStorage (browser)
- **API Integration:** ClickUp API, Google Drive API

---

## Project Structure

```
app/
├── invoice/
│   ├── page.tsx              # Main invoice management page
│   ├── preview/
│   │   └── page.tsx          # PDF preview and print page
│   └── settings/
│       └── page.tsx          # Invoice settings configuration
├── api/
│   └── invoice/
│       └── export-sheets/
│           └── route.ts      # CSV export API endpoint
lib/
├── types.ts                  # TypeScript type definitions
└── clickup.ts                # ClickUp API client
```

---

## Data Models

### InvoiceTask
```typescript
interface InvoiceTask {
  id: string;           // Unique task ID
  taskId: string;       // ClickUp task ID
  name: string;         // Task name (multi-line supported)
  desc: string;         // Task description (multi-line)
  url: string;          // ClickUp task URL (multi-line)
  taskType: TaskType;   // Pricing category
  qty: number | '';     // Quantity for per-unit tasks
  hrs: number | '';     // Hours for hourly tasks
  price: number;        // Calculated or manual price (USD base)
  status: string;       // Task status
}
```

### InvoiceClient
```typescript
interface InvoiceClient {
  name: string;              // Client name
  contactName?: string;      // Contact person name
  email?: string;            // Client email
  address?: string;          // Client address (City, Country)
  currency?: string;         // Client-specific currency (e.g., "PHP", "USD")
  exchangeRate?: number;     // Exchange rate from USD to client currency
  footnote?: string;         // Custom payment notes for this client
  tasks: InvoiceTask[];      // Array of tasks for this client
}
```

### InvoiceSettings
```typescript
interface InvoiceSettings {
  myName: string;                 // Your name (appears on invoice)
  myEmail: string;                // Your email
  myPayment: string;              // Payment details (bank info, etc.)
  paymentNotes: string;           // Global payment notes for all invoices
  googleDriveClientId: string;    // Google OAuth Client ID
  currency: string;               // Default currency (e.g., "USD")
  exchangeRate: number;           // Default exchange rate
  fieldMap: {                     // ClickUp custom field mapping
    taskType: string;
    qty: string;
    date: string;
    client: string;
    taskDesc: string;
  };
}
```

### Task Types & Pricing
```typescript
const TASK_TYPE_RATES = {
  'Regular Page': 20,      // $20 per page
  'Dynamic Page': 30,      // $30 per page
  'Lengthy Page': 30,      // $30 per page
  'Blog/Tour': 15,         // $15 per page
  'Hourly': 7,             // $7 per hour
  'Fixed Price': 0,        // Manual entry
  'N/A / Free': 0          // Free tasks
};
```

---

## Key Features

### 1. Import from ClickUp

**Filter:** Tasks with "Invoice Status = Ready"

**Process:**
1. Click "Import from ClickUp" button
2. Select ClickUp Space → Folder → List
3. System fetches tasks and filters by invoice status
4. Tasks are automatically grouped by client
5. Prices calculated based on task type

**Custom Field Mapping:**
- `Client` → Routes task to client section
- `Task Type` → Determines pricing category
- `Qty` → Quantity for per-unit pricing
- `Date assigned` → Task date
- `Task Description` → Additional notes

### 2. Multi-Currency Support

**Global Settings:**
- Default currency (e.g., USD)
- Default exchange rate (e.g., 1.0 for USD)

**Per-Client Override:**
- Each client can have their own currency
- Each client can have their own exchange rate
- Prices are stored in USD and converted for display

**Example:**
```
Base Price: $100 USD

Client A (PHP, rate: 56.50):
  Display: ₱5,650.00

Client B (EUR, rate: 0.92):
  Display: €92.00

Client C (USD, rate: 1.0):
  Display: $100.00
```

**Grand Total Breakdown:**
```
Grand Total — April 2026
USD    $1,200.00
PHP    ₱56,500.00
EUR    €920.00
```

### 3. Invoice Numbering

**Format:** `JMC-YYYYMMDD`

**Examples:**
- `JMC-20260410` (April 10, 2026)
- `JMC-20260515` (May 15, 2026)

**Customizable:**
- Edit to any format you prefer
- Examples: `JMC-2026Q1-001`, `JMC-001`, `INV-2026-04-10`

### 4. PDF Export

**Features:**
- Select one or multiple clients
- Professional layout with A4 page size
- Multi-line text support
- Per-currency totals
- Client-specific payment notes
- Contact names
- Invoice number display

**Filename Format:**
```
{Client Names} - Invoice - {Invoice Number}.pdf

Examples:
- Acme Corp - Invoice - JMC-20260410.pdf
- Acme Corp, Tech Inc - Invoice - JMC-20260410.pdf
```

**Print Settings:**
- Page size: A4
- Margins: 1cm
- Color preservation enabled
- Page breaks optimized for client sections

### 5. Client Management

**Per-Client Fields:**
- Client Name (required)
- Contact Name (optional) - Shows as "Attn: {Name}" on invoice
- Email (optional)
- Address (optional) - City, Country format
- Currency (optional) - Overrides global currency
- Exchange Rate (optional) - Overrides global rate
- Footnote (optional) - Custom payment notes

**Client Operations:**
- Add new client
- Expand/collapse client sections
- Add tasks to client
- Remove client
- Reorder tasks within client

### 6. Task Operations

**Individual Task:**
- Edit task name (multi-line)
- Edit description (multi-line)
- Edit ClickUp URL (multi-line)
- Change task type
- Edit quantity/hours
- Edit price (for Fixed Price tasks)
- Change status
- Duplicate task
- Insert task below
- Move up/down
- Delete task

**Bulk Operations:**
- Select multiple tasks (checkbox)
- Copy selected tasks
- Paste tasks to any client
- Delete selected tasks

### 7. CSV Export to Google Sheets

**Features:**
- Export all invoice data to CSV format
- Optional upload to Google Drive
- Automatic file naming
- Fallback to local download if Drive fails

**CSV Columns:**
- Client
- Task Name
- Description
- ClickUp URL
- Task Type
- Quantity
- Hours
- Price (in client currency)
- Status

---

## Usage Guide

### Initial Setup

1. **Configure Settings** (`/invoice/settings`)
   - Enter your name and email
   - Add payment details (bank info, etc.)
   - Set global payment notes
   - Configure default currency and exchange rate
   - (Optional) Add Google OAuth Client ID for Drive integration
   - Map ClickUp custom fields

2. **Import Tasks** (`/invoice`)
   - Click "Import from ClickUp"
   - Select Space → Folder → List
   - Tasks with "Invoice Status = Ready" are imported
   - Tasks automatically grouped by client

### Creating an Invoice

1. **Review Imported Tasks**
   - Check task names, descriptions, URLs
   - Verify pricing is correct
   - Edit Fixed Price amounts if needed

2. **Configure Clients**
   - Expand client sections
   - Add contact names
   - Set client-specific currency/rate if needed
   - Add custom payment notes (footnote)

3. **Set Invoice Details**
   - Edit month field (e.g., "April 2026")
   - Edit invoice number (default: JMC-YYYYMMDD)

4. **Generate PDF**
   - Click "Preview PDF"
   - Select clients to include (one or all)
   - Click "Generate PDF"
   - Review in new tab
   - Click "Print / Save PDF"
   - Choose "Save as PDF" in print dialog

### Exporting to CSV

1. **Click "Export CSV"**
2. If Google Drive configured:
   - Authorizes with Google
   - Uploads CSV to Drive
   - Downloads CSV locally as backup
3. If no Drive:
   - Downloads CSV to local machine

---

## Configuration

### Settings Page Fields

**Personal Information:**
- **My Name:** Your name (appears on invoices)
- **My Email:** Your email address
- **My Payment Details:** Bank account info, payment methods (multi-line)

**Payment Notes:**
- **Invoice Footer Notes:** Global payment terms that appear on all invoices unless client has custom footnote

**Google Drive Integration:**
- **Google OAuth Client ID:** For automatic CSV uploads to Drive
- Setup instructions: See `GOOGLE_DRIVE_SETUP.md`

**Currency & Exchange Rate:**
- **Currency:** Default currency code (USD, PHP, EUR, etc.)
- **Exchange Rate:** Conversion rate from USD to your currency

**ClickUp Field Mapping:**
- **Task Type Field:** ClickUp custom field name for task type
- **Qty Field:** Field name for quantity
- **Date Field:** Field name for date assigned
- **Client Field:** Field name for client
- **Task Description Field:** Field name for description

### Default Values

```javascript
{
  myName: '',
  myEmail: '',
  myPayment: '',
  paymentNotes: '',
  googleDriveClientId: '',
  currency: 'USD',
  exchangeRate: 1,
  fieldMap: {
    taskType: 'Task Type',
    qty: 'Qty',
    date: 'Date assigned',
    client: 'Client',
    taskDesc: 'Task Description'
  }
}
```

---

## Multi-Currency Support

### How It Works

1. **Base Currency:** All prices stored in USD
2. **Conversion:** Prices converted using exchange rates for display
3. **Per-Client:** Each client can override global currency settings

### Setting Up Multi-Currency

**Global (Settings Page):**
```
Currency: USD
Exchange Rate: 1
```

**Per-Client (Invoice Page):**
```
Client A:
  Currency: PHP
  Exchange Rate: 56.50

Client B:
  Currency: EUR
  Exchange Rate: 0.92

Client C:
  (Uses global USD)
```

### Currency Display

**Task Prices:**
- Shown in client's currency
- Fixed Price tasks show currency symbol

**Subtotals:**
- Per-client subtotal in client currency

**Grand Total:**
- Separate line for each currency
- Example:
  ```
  USD    $1,200.00
  PHP    ₱56,500.00
  EUR    €920.00
  ```

### Supported Currencies

Any valid ISO 4217 currency code:
- USD - US Dollar ($)
- PHP - Philippine Peso (₱)
- EUR - Euro (€)
- GBP - British Pound (£)
- JPY - Japanese Yen (¥)
- And many more...

---

## PDF Export

### Features

**Layout:**
- A4 page size
- 1cm margins
- Professional header with invoice number
- Client sections with contact names
- Task tables with multi-line support
- Per-client subtotals
- Payment notes/footnotes
- Grand total breakdown by currency

**Page Breaks:**
- Optimized to keep client sections together
- Tables can span pages
- Rows never split mid-row

**Colors:**
- Background colors preserved
- Dark headers print correctly

### PDF Filename

**Format:**
```
{Client Names} - Invoice - {Invoice Number}.pdf
```

**Examples:**
```
Single Client:
  Acme Corp - Invoice - JMC-20260410.pdf

Multiple Clients:
  Acme Corp, Tech Solutions, Beta Inc - Invoice - JMC-20260410.pdf
```

### Generating PDF

1. Click "Preview PDF" button
2. Select clients (one or all)
3. Click "Generate PDF"
4. New tab opens with preview
5. Click "Print / Save PDF"
6. In print dialog:
   - Destination: "Save as PDF"
   - Layout: Portrait
   - Margins: Default
   - Click "Save"

### Print CSS

```css
@media print {
  @page {
    size: A4;
    margin: 1cm;
  }
  body {
    print-color-adjust: exact;
    -webkit-print-color-adjust: exact;
  }
  .page-break-inside-avoid {
    page-break-inside: avoid;
    break-inside: avoid;
  }
  table {
    page-break-inside: auto;
  }
  tr {
    page-break-inside: avoid;
    page-break-after: auto;
  }
}
```

---

## Troubleshooting

### PDF Issues

**Problem:** First page only shows header
- **Solution:** Fixed in latest version with `print:min-h-0` class

**Problem:** PDF filename is "clickup-migrator"
- **Solution:** Document title now set immediately when data loads

**Problem:** Multi-line text not showing in PDF
- **Solution:** Added `whitespace-pre-wrap` to preserve line breaks

**Problem:** Page breaks in wrong places
- **Solution:** Print CSS optimized with page-break rules

### Currency Issues

**Problem:** Page crashes when typing currency code
- **Solution:** Added validation to require 3-letter codes

**Problem:** Grand total shows single currency
- **Solution:** Updated to group by currency and show breakdown

**Problem:** Currency symbol not updating
- **Solution:** Now uses client-specific currency for all displays

### Import Issues

**Problem:** Tasks not importing
- **Check:** ClickUp token is valid
- **Check:** "Invoice Status" field exists and is set to "Ready"
- **Check:** Field mapping in settings matches ClickUp field names

**Problem:** Tasks in wrong client
- **Check:** "Client" field is correctly set in ClickUp
- **Check:** Field mapping for "client" is correct

### Export Issues

**Problem:** CSV export fails
- **Check:** Browser console for errors
- **Check:** Google Drive token if using Drive upload
- **Fallback:** CSV data returned even if Drive fails

**Problem:** Multi-line text breaks CSV
- **Solution:** Text is sanitized and properly escaped

---

## Data Storage

### localStorage Keys

- `invoice_data` - Current invoice data (month, invoiceNumber, clients)
- `invoice_settings` - User settings
- `invoice_preview_data` - Temporary data for PDF preview
- `clickup_token` - ClickUp API token

### Data Persistence

- All data saved automatically to localStorage
- Data persists across browser sessions
- No server-side storage
- Export to CSV for backup

---

## API Integration

### ClickUp API

**Endpoints Used:**
- `GET /list/{list_id}/task` - Fetch tasks from list
- `GET /task/{task_id}` - Get task details
- Custom fields accessed via task data

**Authentication:**
- Bearer token stored in localStorage/sessionStorage
- Token required for all API calls

### Google Drive API

**OAuth 2.0 Flow:**
1. User clicks export
2. Redirects to Google OAuth
3. User authorizes
4. Token stored temporarily
5. CSV uploaded to Drive

**Scopes Required:**
- `https://www.googleapis.com/auth/drive.file`

---

## Future Enhancements

### Potential Features
- [ ] Recurring invoice templates
- [ ] Invoice history/archive
- [ ] Email invoice directly to clients
- [ ] Payment tracking (paid/unpaid status)
- [ ] Tax calculations
- [ ] Discount support
- [ ] Multiple invoice templates
- [ ] Invoice preview before import
- [ ] Batch invoice generation
- [ ] Invoice analytics/reports

---

## Version History

### v1.0 (April 2026)
- Initial invoice system
- ClickUp import integration
- Basic PDF export
- CSV export to Google Sheets

### v1.1 (April 2026)
- Multi-currency support
- Per-client currency and exchange rates
- Invoice numbering system
- Contact name per client
- Payment notes (global and per-client)

### v1.2 (April 2026)
- Multi-line text support
- Fixed Price editable amounts
- Per-currency grand total breakdown
- PDF filename customization
- Print CSS optimizations
- Currency validation and error handling

---

## Credits

**Developer:** Paul Jezreel S. Bondad  
**Email:** jezreel.bondad@gmail.com  
**Project:** ClickUp Migrator with Invoice Management  
**Framework:** Next.js 15 + React 19 + TailwindCSS 4  

---

## License

This is a private project for internal use.

---

## Support

For issues or questions:
1. Check this documentation
2. Review browser console for errors
3. Check localStorage data
4. Verify ClickUp API token
5. Contact developer

---

**Last Updated:** April 10, 2026  
**Documentation Version:** 1.2
