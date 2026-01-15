# Walkthrough: Cloudflare Proxy & Dual-Stack Auth

This document outlines the changes made to enable domestic access via Cloudflare Workers and Supabase, while maintaining Firebase as a fallback.

## 1. Architecture Overview
*   **Dual-Stack**: The app now supports both Firebase (default) and Supabase (via Proxy).
*   **Auto-Switching**: 
    *   On load, checks `public/proxy-config.json` (hosted on GitHub Pages).
    *   If `useProxy: true`, forces Supabase.
    *   If `false` (default), tries Firebase first, falls back to Supabase if blocked.
*   **Proxy**: Uses Cloudflare Workers to proxy requests to Supabase, bypassing firewall restrictions.

## 2. Key Files
*   `workers/proxy.js`: The Cloudflare Worker script.
*   `src/authConfig.js`: Configuration file (contains Worker URL & Supabase Key).
*   `src/services/chatProvider.js`: Factory to switch betweeen `FirebaseService` and `SupabaseService`.
*   `supabase_schema.sql`: SQL to set up the database tables.

## 3. How to Verify
1.  **Deployment**: 
    *   Worker is deployed to `https://mychatpwa.silencezx009.workers.dev`.
    *   Supabase tables are created.
2.  **Testing**:
    *   Modify `public/proxy-config.json` to `"useProxy": true` locally or on GitHub.
    *   Reload App. Console should say `初始化 Chat Service: supabase`.
    *   Create a room and chat.

## 4. Next Steps
*   To enable this for all domestic users, change `public/proxy-config.json` on **GitHub** to `true`.
