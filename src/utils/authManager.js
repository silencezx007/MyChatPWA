import { createClient } from '@supabase/supabase-js';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { AUTH_CONFIG } from '../authConfig';

// 初始化 Supabase 客户端 (走 Cloudflare Worker 代理)
const supabase = createClient(AUTH_CONFIG.SUPABASE_PROXY_URL, AUTH_CONFIG.SUPABASE_ANON_KEY);

// 初始化 Firebase 客户端
const firebaseApp = initializeApp(AUTH_CONFIG.FIREBASE_CONFIG);
const firebaseAuth = getAuth(firebaseApp);

export const authManager = {
    /**
     * 获取远程配置，判断是否强制开启代理
     */
    async getRemoteConfig() {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 2000); // 2秒超时

            const response = await fetch(AUTH_CONFIG.REMOTE_CONFIG_URL, {
                signal: controller.signal,
                cache: 'no-store' // 确保获取最新配置
            });
            clearTimeout(timeoutId);

            if (response.ok) {
                const config = await response.json();
                console.log("远程配置加载成功:", config);
                return config;
            }
        } catch (e) {
            console.warn("无法加载远程配置，使用默认策略:", e.message);
        }
        return { useProxy: false }; // 默认不强制，走自动探测
    },

    /**
     * 登录处理逻辑
     */
    async handleLogin(email, password) {
        console.log("开始登录流程...");

        // 1. 检查远程开关
        const remoteConfig = await this.getRemoteConfig();

        if (remoteConfig.useProxy) {
            console.log("远程配置指示强制使用 Supabase 代理。");
            return this.loginViaSupabase(email, password);
        }

        // 2. 正常流程：探测 Firebase 连通性
        try {
            // 策略：先尝试 Firebase (针对海外/VPN用户)
            // 设置一个 2.5 秒的超时探测
            const isFirebaseAvailable = await Promise.race([
                fetch('https://www.googleapis.com/identitytoolkit/v3/relyingparty/', { mode: 'no-cors' }).then(() => true),
                new Promise(resolve => setTimeout(() => resolve(false), 2500))
            ]);

            if (isFirebaseAvailable) {
                console.log("检测到 Firebase 环境可用，正在登录...");
                try {
                    const res = await signInWithEmailAndPassword(firebaseAuth, email, password);
                    return { platform: 'firebase', user: res.user };
                } catch (firebaseErr) {
                    // 如果 Firebase 连接通畅但登录报 "Network Error" 或其他非密码错误，也尝试降级
                    // 这里主要由 catch 捕获
                    throw firebaseErr;
                }
            } else {
                console.log("Firebase 连接超时，自动切换至 Supabase 代理...");
                return await this.loginViaSupabase(email, password);
            }
        } catch (err) {
            console.error("Firebase 登录尝试失败:", err.message);
            console.log("尝试降级到 Supabase 代理...");
            // 任何 Firebase 错误（包括超时、网络不行、甚至密码错误? 不，密码错误不应该切代理，只有网络错误才切）
            // 细化：如果是 auth/wrong-password，不应该重试 Supabase (因为两边账号如果不通的话)
            // 但这里假设两边可能是通的或者就是为了解决网络问题。简单起见，失败都尝试 Supabase。
            return await this.loginViaSupabase(email, password);
        }
    },

    async loginViaSupabase(email, password) {
        try {
            const { data, error } = await supabase.auth.signInWithPassword({ email, password });
            if (error) throw error;
            return { platform: 'supabase', user: data.user };
        } catch (err) {
            throw new Error("Supabase 代理登录也失败: " + err.message);
        }
    }
};
