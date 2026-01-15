# Deployment Guide: Cloudflare Proxy & Auth Setup

## 1. Cloudflare Workers Deployment (Step-by-Step)
This step is verified to work with your provided code in `workers/proxy.js`.

1.  **Log in** to your [Cloudflare Dashboard](https://dash.cloudflare.com/).
2.  Go to **Workers & Pages** -> **Create Application** -> **Create Worker**.
3.  Name the worker (e.g., `mychat-proxy`).
4.  **Click "Deploy"** (Default Hello World is fine for now).
5.  **Edit Code**:
    *   Click **"Edit code"** button.
    *   Delete the existing code.
    *   Copy *all content* from your local file `workers/proxy.js`.
    *   Paste it into the Cloudflare editor.
    *   Click **"Save and Deploy"**.
6.  **Set Environment Variable (Crucial)**:
    *   Go back to the Worker's settings page (Settings -> Variables).
    *   Click **"Add Variable"**.
    *   Name: `SUPABASE_URL`
    *   Value: `https://rdyqfbtgttjbqxhinxnm.supabase.co`  (Your project URL)
    *   Click **"Save and Deploy"** again if prompted.
7.  **GET THE URL**:
    *   On the Worker's main dashboard page, look for the **"Preview"** or **"Worker Link"**.
    *   It looks like: `https://mychat-proxy.silencezx007.workers.dev`
    *   **COPY THIS EXACT URL**. This is your "Worker URL".

## 2. Update Local Config
1.  Open `src/authConfig.js` in VS Code.
2.  Find the line: `SUPABASE_PROXY_URL: '...'`
3.  Replace the value with the URL you just copied.
    *   Example: `SUPABASE_PROXY_URL: 'https://mychat-proxy.silencezx007.workers.dev'`

## 2. Supabase Setup
1.  Ensure you have a Supabase project.
2.  Get your **Anon Key** and **Project URL**.
3.  Update `src/authConfig.js` with the `SUPABASE_ANON_KEY`.

## 3. Remote Switch (GitHub Pages)
We use `public/proxy-config.json` to control the proxy behavior dynamically.

1.  Push your changes to GitHub:
    ```bash
    git add .
    git commit -m "feat: add proxy config"
    git push
    ```
2.  Your `proxy-config.json` will be accessible at `https://silencezx007.github.io/MyChatPWA/proxy-config.json` (or similar path depending on your repo settings).
3.  **Update URL**: Check `src/authConfig.js` to ensure `REMOTE_CONFIG_URL` matches your actual GitHub Pages URL.

## 4. CRITICAL: Database Compatibility
**Current Issue**: Even if users login via Supabase (Proxy), the Chat messages are still stored in **Firebase Firestore**.
*   If a user cannot access Firebase Auth, they likely **cannot access Firestore** either.
*   **Result**: They will login successfully but messages won't load/send.

**Recommendation**:
*   To fully support domestic users, you must either:
    *   Migrate the Database to Supabase (Postgres).
    *   Or setup a proxy for Firestore as well (extremely complex).
