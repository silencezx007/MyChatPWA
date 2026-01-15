// src/authConfig.js
export const AUTH_CONFIG = {
    // Cloudflare Worker 域名。请在部署您的 Worker 后，将其替换为您的 Worker 实际域名。
    // 您的 Supabase 项目 URL (https://rdyqfbtgttjbqxhinxnm.supabase.co) 应作为环境变量 SUPABASE_URL 配置在您的 Cloudflare Worker 中。
    SUPABASE_PROXY_URL: 'https://mychatpwa.silencezx009.workers.dev',
    // Supabase Anon Key
    SUPABASE_ANON_KEY: 'sb_publishable_ZHdoAGn6_5rFl3zQC31EQg_7l38g3D_',

    FIREBASE_CONFIG: {
        apiKey: "AIzaSyDmZvNb4c8vYU6D3xgPxvGrXwDkdnAkQco",
        authDomain: "secretalk-ec8bb.firebaseapp.com",
        projectId: "secretalk-ec8bb",
        storageBucket: "secretalk-ec8bb.firebasestorage.app",
        messagingSenderId: "652047176963",
        appId: "1:652047176963:web:d1b6f9302d1377a4434536"
    },

    // GitHub 远程控制配置 URL
    // 用于动态控制是否强制使用代理
    REMOTE_CONFIG_URL: 'https://silencezx007.github.io/proxy-config.json'
};
