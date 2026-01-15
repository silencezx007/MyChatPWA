import { authManager } from '../utils/authManager';
import { firebaseService } from './firebaseService';
import { supabaseService } from './supabaseService';

export const chatProvider = {
    currentService: null,

    async getService() {
        if (this.currentService) return this.currentService;

        // 根据 AuthManager 的登录结果决定使用哪个 Service
        // 注意：我们需要先等待 AuthManager 完成登录流程拿到 platform
        // 这里我们假设组件层会先调用 authManager.handleLogin

        // 为了灵活性，我们也可以在这里再次检查配置，但最好是依赖传入的参数或全局状态
        // 由于 App.vue 中登录返回了 { platform: 'firebase' | 'supabase' }
        // 我们提供一个 setService 方法供 App.vue 调用
        return this.currentService || firebaseService; // 默认 fallback
    },

    initService(platform) {
        console.log(`初始化 Chat Service: ${platform}`);
        if (platform === 'supabase') {
            this.currentService = supabaseService;
        } else {
            this.currentService = firebaseService;
        }
        return this.currentService;
    }
};
