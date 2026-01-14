import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import { registerSW } from 'virtual:pwa-register'

// 注册 Service Worker，每 60 秒检查一次更新
const updateSW = registerSW({
  onNeedRefresh() {
    // 有新版本可用时自动刷新（无感更新）
    updateSW(true)
  },
  onOfflineReady() {
    console.log('App ready to work offline')
  },
  // 每 60 秒检查一次更新
  onRegisteredSW(swUrl, registration) {
    if (registration) {
      setInterval(() => {
        registration.update()
      }, 60 * 1000) // 60秒
    }
  }
})

createApp(App).mount('#app')
