# Google Drive Integration Setup

The Invoice Manager can automatically upload CSV exports to your Google Drive.

## Setup Steps

### 1. Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the **Google Drive API**:
   - Go to **APIs & Services** → **Library**
   - Search for "Google Drive API"
   - Click **Enable**

### 2. Create OAuth 2.0 Credentials

1. Go to **APIs & Services** → **Credentials**
2. Click **Create Credentials** → **OAuth client ID**
3. If prompted, configure the OAuth consent screen:
   - User Type: **External**
   - App name: `ClickUp Invoice Manager` (or your choice)
   - User support email: Your email
   - Developer contact: Your email
   - Add scope: `https://www.googleapis.com/auth/drive.file`
   - Add your email as a test user
4. Create OAuth Client ID:
   - Application type: **Web application**
   - Name: `Invoice Manager`
   - **Authorized redirect URIs**: Add your app URL + `/invoice`
     - Example: `http://localhost:3000/invoice`
     - Example: `https://yourdomain.com/invoice`
5. Copy the **Client ID** (looks like `123456789-abc123.apps.googleusercontent.com`)

### 3. Configure in Invoice Manager

1. Go to **Invoice Manager** → **Settings**
2. Scroll to **Google Drive Integration**
3. Paste your **Client ID**
4. Click **Save Settings**

## How It Works

When you click **Export CSV**:
1. A popup opens asking you to sign in with Google
2. You authorize the app to upload files to your Drive
3. The CSV is downloaded to your computer **AND** uploaded to your Google Drive
4. You'll see a success message: "✓ CSV downloaded & uploaded to Google Drive"

## Notes

- The access token is cached in your browser session (valid for ~1 hour)
- Only files created by this app are accessible (not your entire Drive)
- The app uses OAuth 2.0 implicit flow (no server-side secrets needed)
- If you don't configure Google Drive, CSV export still works (download only)

## Troubleshooting

**"Google Drive Client ID not configured"**
- Go to Settings and add your OAuth Client ID

**Popup blocked**
- Allow popups for this site in your browser

**"redirect_uri_mismatch" error**
- Make sure the redirect URI in Google Cloud Console matches exactly: `http://localhost:3000/invoice` or your production URL

**Files not appearing in Drive**
- Check your Google Drive → "My Drive" root folder
- The file is named `Invoice-[Month]-[Year].csv`
