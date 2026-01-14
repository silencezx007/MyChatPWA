<template>
  <div :class="['container', { flash: isFlashing }]">
    <!-- 登录界面 -->
    <div v-if="state === 'login'" class="screen center">
      <div class="logo">🔐</div>
      <h1 class="title">NiceTalk</h1>
      
      <div class="login-box">
        <div class="input-group">
          <label>VIP</label>
          <input v-model="form.roomId" type="text" />
        </div>
        
        <div class="input-group">
          <label>Code</label>
          <input v-model="form.password" type="password" @keyup.enter="joinOrCreateRoom" />
        </div>

        <button @click="joinOrCreateRoom" class="btn-primary" :disabled="!isValidForm || isLoading">
          {{ btnText }}
        </button>
        <p class="hint" v-if="errorMsg">{{ errorMsg }}</p>
      </div>
    </div>

    <!-- 等待界面 -->
    <div v-if="state === 'waiting'" class="screen center">
      <div class="waiting-animation">
        <div class="pulse-ring"></div>
        <div class="pulse-ring delay-1"></div>
        <div class="pulse-ring delay-2"></div>
        <div class="loader"></div>
      </div>
      <h2>房间: {{ form.roomId }}</h2>
      <p class="status-text">...天边...眼前</p>
      <button @click="leaveRoom" class="btn-text">取消等待</button>
    </div>

    <!-- 聊天界面 -->
    <div v-if="state === 'chatting'" class="chat-screen">
      <header class="chat-header">
        <div class="header-info">
          <span class="room-badge">{{ form.roomId }}</span>
          <span class="status-dot"></span> 加密连接中
        </div>
        <div class="header-actions">
          <button @click="showSettings = true" class="btn-icon" title="设置">⚙️</button>
          <button @click="destroyRoom" class="btn-danger">销毁</button>
        </div>
      </header>
      
      <div class="messages" ref="msgBox">
        <div v-if="messages.length === 0" class="empty-messages">
          <p>👋 开始聊天吧</p>
        </div>
        <div v-for="msg in messages" :key="msg.id" 
             :class="['bubble', msg.sender === myId ? 'me' : 'them']">
          {{ msg.text }}
        </div>
      </div>

      <div class="input-area">
        <input v-model="inputText" @keyup.enter="sendMessage" placeholder="输入消息..." />
        <button @click="sendMessage" class="send-btn" :disabled="!inputText.trim()">
          发送
        </button>
      </div>
    </div>

    <!-- 房间销毁提示弹窗 -->
    <div v-if="showDestroyed" class="modal-overlay" @click="closeDestroyedModal">
      <div class="modal" @click.stop>
        <div class="modal-icon">🔥</div>
        <h3>房间已销毁</h3>
        <p>聊天记录已被永久删除</p>
        <button class="btn-primary" @click="closeDestroyedModal">确定</button>
      </div>
    </div>

    <!-- 设置弹窗 -->
    <div v-if="showSettings" class="modal-overlay" @click="showSettings = false">
      <div class="modal settings-modal" @click.stop>
        <div class="modal-header">
          <h3>🔔 通知设置</h3>
          <button class="btn-close" @click="showSettings = false">✕</button>
        </div>
        <div class="settings-list">
          <div class="setting-item" @click="toggleSetting('soundEnabled')">
            <span class="setting-label">🔊 声音提示</span>
            <span :class="['toggle', { active: settings.soundEnabled }]"></span>
          </div>
          <div class="setting-item" @click="toggleSetting('vibrationEnabled')">
            <span class="setting-label">📳 振动反馈</span>
            <span :class="['toggle', { active: settings.vibrationEnabled }]"></span>
          </div>
          <div class="setting-item" @click="toggleSetting('flashEnabled')">
            <span class="setting-label">💡 屏幕闪烁</span>
            <span :class="['toggle', { active: settings.flashEnabled }]"></span>
          </div>
        </div>
        <p class="settings-note">设置会自动保存</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue';
import { db, auth } from './firebase';
import { signInAnonymously } from "firebase/auth";
import { 
  collection, doc, setDoc, getDoc, getDocs, updateDoc, deleteDoc, onSnapshot, 
  serverTimestamp, query, orderBy, arrayUnion 
} from "firebase/firestore";

// ==================== 状态管理 ====================
const state = ref('login'); // login, waiting, chatting
const myId = ref(null);
const form = ref({ roomId: '', password: '' });
const errorMsg = ref('');
const messages = ref([]);
const inputText = ref('');
const msgBox = ref(null);
const btnText = ref('进入房间');
const isLoading = ref(false);
const showDestroyed = ref(false);

// 监听器
let unsubscribeRoom = null;
let unsubscribeMessages = null;

// ==================== 通知相关 ====================
let titleBlinkInterval = null;
const originalTitle = 'NiceTalk';
let originalFavicon = null;
let audioContext = null; // 预初始化的音频上下文
const isFlashing = ref(false); // 屏幕闪烁状态

// ==================== 通知设置 ====================
const showSettings = ref(false);
const settings = ref({
  soundEnabled: true,
  vibrationEnabled: true,
  flashEnabled: true
});

// 从 localStorage 加载设置
const loadSettings = () => {
  try {
    const saved = localStorage.getItem('nicetalk_settings');
    if (saved) {
      settings.value = { ...settings.value, ...JSON.parse(saved) };
    }
  } catch (e) {
    console.log('加载设置失败:', e);
  }
};

// 保存设置到 localStorage
const saveSettings = () => {
  try {
    localStorage.setItem('nicetalk_settings', JSON.stringify(settings.value));
  } catch (e) {
    console.log('保存设置失败:', e);
  }
};

// 切换设置项
const toggleSetting = (key) => {
  settings.value[key] = !settings.value[key];
  saveSettings();
  
  // 如果开启声音，预初始化音频
  if (key === 'soundEnabled' && settings.value.soundEnabled) {
    initAudioContext();
  }
};

// 预初始化音频上下文（需要用户交互触发）
const initAudioContext = () => {
  try {
    if (!audioContext) {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    // 恢复被暂停的 AudioContext（移动端要求）
    if (audioContext.state === 'suspended') {
      audioContext.resume();
    }
  } catch (e) {
    console.log('初始化音频上下文失败:', e);
  }
};

// 播放提示音
const playNotificationSound = () => {
  try {
    // 如果没有预初始化，尝试创建新的
    if (!audioContext) {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    
    // 恢复被暂停的 AudioContext
    if (audioContext.state === 'suspended') {
      audioContext.resume();
    }
    
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.value = 800; // 频率
    oscillator.type = 'sine';
    gainNode.gain.value = 0.3; // 音量
    
    oscillator.start();
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
    oscillator.stop(audioContext.currentTime + 0.2);
  } catch (e) {
    console.log('无法播放提示音:', e);
  }
};

// 振动反馈（Android 支持）
const vibrateDevice = () => {
  if ('vibrate' in navigator) {
    navigator.vibrate([200, 100, 200]); // 短-停-短
  }
};

// 屏幕闪烁效果（移动端 PWA 可见）
const flashScreen = () => {
  isFlashing.value = true;
  setTimeout(() => {
    isFlashing.value = false;
  }, 1000);
};

// 创建带红点的 favicon
const createBadgeFavicon = () => {
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 32;
  const ctx = canvas.getContext('2d');
  
  // 绘制原始图标背景（蓝色锁）
  ctx.fillStyle = '#007AFF';
  ctx.beginPath();
  ctx.arc(16, 16, 14, 0, Math.PI * 2);
  ctx.fill();
  
  // 绘制锁图标
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(10, 14, 12, 10);
  ctx.beginPath();
  ctx.arc(16, 14, 5, Math.PI, 0, false);
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#FFFFFF';
  ctx.stroke();
  
  // 绘制红点
  ctx.fillStyle = '#FF3B30';
  ctx.beginPath();
  ctx.arc(26, 6, 6, 0, Math.PI * 2);
  ctx.fill();
  
  return canvas.toDataURL('image/png');
};

// 设置 favicon
const setFavicon = (url) => {
  let link = document.querySelector("link[rel*='icon']");
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    document.head.appendChild(link);
  }
  link.href = url;
};

// 开始标题闪烁和设置红点 favicon
const startNotification = () => {
  // 保存原始 favicon
  if (!originalFavicon) {
    const existingLink = document.querySelector("link[rel*='icon']");
    originalFavicon = existingLink ? existingLink.href : '/vite.svg';
  }
  
  // 设置带红点的 favicon
  setFavicon(createBadgeFavicon());
  
  // 开始标题闪烁
  if (!titleBlinkInterval) {
    let showDot = true;
    titleBlinkInterval = setInterval(() => {
      document.title = showDot ? '● 新消息 - NiceTalk' : 'NiceTalk';
      showDot = !showDot;
    }, 800);
  }
  
  // 播放提示音（根据设置）
  if (settings.value.soundEnabled) {
    playNotificationSound();
  }
  
  // 振动反馈（根据设置）
  if (settings.value.vibrationEnabled) {
    vibrateDevice();
  }
  
  // 屏幕闪烁效果（根据设置）
  if (settings.value.flashEnabled) {
    flashScreen();
  }
};

// 停止通知（清除标题闪烁和恢复 favicon）
const stopNotification = () => {
  // 停止标题闪烁
  if (titleBlinkInterval) {
    clearInterval(titleBlinkInterval);
    titleBlinkInterval = null;
  }
  document.title = originalTitle;
  
  // 恢复原始 favicon
  if (originalFavicon) {
    setFavicon(originalFavicon);
  }
};

// ==================== 初始化 ====================
onMounted(async () => {
  try {
    const userCred = await signInAnonymously(auth);
    myId.value = userCred.user.uid;
  } catch (e) {
    console.error('登录失败:', e);
    errorMsg.value = '连接失败，请刷新重试';
  }
  
  // 加载用户设置
  loadSettings();
  
  // 请求通知权限（iOS PWA Badge 需要）
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
  
  // 页面可见时清除所有通知
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      // 清除 App Badge
      if ('clearAppBadge' in navigator) {
        navigator.clearAppBadge().catch(() => {});
      }
      // 停止标题闪烁和恢复 favicon
      stopNotification();
    }
  });
});

onUnmounted(() => {
  // 页面关闭时清理监听器
  if (unsubscribeMessages) unsubscribeMessages();
  if (unsubscribeRoom) unsubscribeRoom();
});

// ==================== 计算属性 ====================
const isValidForm = computed(() => {
  return form.value.roomId.trim().length > 0 && form.value.password.trim().length > 0;
});

// ==================== 核心逻辑 ====================

// 进入或创建房间
const joinOrCreateRoom = async () => {
  if (!myId.value) {
    errorMsg.value = '未登录，请刷新页面';
    return;
  }
  
  errorMsg.value = '';
  isLoading.value = true;
  btnText.value = '连接中...';
  
  const roomId = form.value.roomId.trim();
  const password = form.value.password.trim();
  const roomRef = doc(db, 'rooms', roomId);

  try {
    const docSnap = await getDoc(roomRef);

    if (docSnap.exists()) {
      // 房间存在 -> 尝试加入
      const data = docSnap.data();
      
      // 0. 检查房间是否过期
      if (data.expiresAt && data.expiresAt.toDate() < new Date()) {
        // 房间已过期，静默清理后创建新房间
        const messagesRef = collection(db, `rooms/${roomId}/messages`);
        const snapshot = await getDocs(messagesRef);
        for (const d of snapshot.docs) {
          await deleteDoc(d.ref);
        }
        await deleteDoc(roomRef);
        
        // 创建新房间（复用下方创建逻辑）
        await setDoc(roomRef, {
          roomId: roomId,
          password: password,
          participants: [myId.value],
          createdAt: serverTimestamp(),
          expiresAt: new Date(Date.now() + 10 * 60 * 1000),
          status: 'waiting'
        });
        
        startListening(roomId);
        return;
      }
      
      // 1. 校验密码
      if (data.password !== password) {
        errorMsg.value = '密码错误，无法进入该房间';
        resetButton();
        return;
      }
      
      // 2. 校验人数
      if (data.participants.length >= 2 && !data.participants.includes(myId.value)) {
        errorMsg.value = '房间已满 (2人)';
        resetButton();
        return;
      }

      // 3. 加入房间
      if (!data.participants.includes(myId.value)) {
        await updateDoc(roomRef, {
          participants: arrayUnion(myId.value),
          status: 'active'
        });
      }
      
      startListening(roomId);

    } else {
      // 房间不存在 -> 创建新房间
      await setDoc(roomRef, {
        roomId: roomId,
        password: password,
        participants: [myId.value],
        createdAt: serverTimestamp(),
        expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10分钟后过期
        status: 'waiting'
      });
      
      startListening(roomId);
    }
  } catch (e) {
    console.error('连接失败:', e);
    errorMsg.value = '连接失败，请检查网络';
    resetButton();
  }
};

// 重置按钮状态
const resetButton = () => {
  isLoading.value = false;
  btnText.value = '进入房间';
};

// 监听房间状态和消息
const startListening = (roomId) => {
  // 监听房间文档
  unsubscribeRoom = onSnapshot(doc(db, 'rooms', roomId), (docSnap) => {
    if (!docSnap.exists()) {
      // 房间被销毁了
      showDestroyed.value = true;
      cleanup();
      return;
    }
    
    const data = docSnap.data();
    
    // 判断状态
    if (data.participants.length === 2) {
      state.value = 'chatting';
      isLoading.value = false;
      
      // 预初始化音频上下文（需要用户交互后才能生效）
      initAudioContext();
      
      // 开始监听消息
      if (!unsubscribeMessages) {
        const q = query(collection(db, `rooms/${roomId}/messages`), orderBy('createdAt'));
        let prevCount = 0;
        unsubscribeMessages = onSnapshot(q, (snap) => {
          const newMessages = snap.docs.map(d => ({ id: d.id, ...d.data() }));
          
          // 检查是否有新消息（非自己发送的）
          if (newMessages.length > prevCount && document.hidden) {
            const latestMsg = newMessages[newMessages.length - 1];
            if (latestMsg.sender !== myId.value) {
              // 设置 App Badge（红点）
              if ('setAppBadge' in navigator) {
                navigator.setAppBadge().catch(() => {});
              }
              // 启动通知：标题闪烁 + favicon 红点 + 声音
              startNotification();
            }
          }
          prevCount = newMessages.length;
          
          messages.value = newMessages;
          nextTick(() => {
            if (msgBox.value) {
              msgBox.value.scrollTop = msgBox.value.scrollHeight;
            }
          });
        });
      }
    } else {
      state.value = 'waiting';
      isLoading.value = false;
    }
  }, (err) => {
    console.error('监听房间失败:', err);
    errorMsg.value = '连接中断';
    cleanup();
  });
};

// 发送消息
const sendMessage = async () => {
  if (!inputText.value.trim()) return;
  
  const text = inputText.value.trim();
  inputText.value = '';
  
  try {
    await setDoc(doc(collection(db, `rooms/${form.value.roomId}/messages`)), {
      text,
      sender: myId.value,
      createdAt: serverTimestamp()
    });
  } catch (e) {
    console.error('发送失败:', e);
    errorMsg.value = '发送失败';
  }
};

// 销毁房间 (阅后即焚)
const destroyRoom = async () => {
  try {
    const roomId = form.value.roomId;
    
    // 先删除消息子集合中的所有文档
    const messagesRef = collection(db, `rooms/${roomId}/messages`);
    const snapshot = await getDocs(messagesRef);
    
    // 逐个删除消息
    for (const docSnap of snapshot.docs) {
      await deleteDoc(docSnap.ref);
    }
    
    // 再删除房间文档
    await deleteDoc(doc(db, 'rooms', roomId));
    // onSnapshot 会自动检测到删除并触发 cleanup
  } catch (e) {
    console.error('销毁失败:', e);
  }
};

// 离开房间 (取消等待)
const leaveRoom = async () => {
  try {
    await deleteDoc(doc(db, 'rooms', form.value.roomId));
  } catch (e) {
    console.error('离开失败:', e);
  }
  cleanup();
};

// 清理状态
const cleanup = () => {
  if (unsubscribeMessages) {
    unsubscribeMessages();
    unsubscribeMessages = null;
  }
  if (unsubscribeRoom) {
    unsubscribeRoom();
    unsubscribeRoom = null;
  }
  
  state.value = 'login';
  messages.value = [];
  resetButton();
};

// 关闭销毁提示弹窗
const closeDestroyedModal = () => {
  showDestroyed.value = false;
};
</script>

<style>
/* ==================== CSS Variables ==================== */
:root {
  --bg-primary: #F2F2F7;
  --bg-secondary: #FFFFFF;
  --text-primary: #000000;
  --text-secondary: #8E8E93;
  --blue: #007AFF;
  --red: #FF3B30;
  --green: #34C759;
  --bubble-mine: #007AFF;
  --bubble-theirs: #E9E9EB;
  
  --font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Helvetica Neue', sans-serif;
  --radius-sm: 12px;
  --radius-md: 20px;
  --radius-lg: 24px;
  --radius-full: 9999px;
  
  --safe-area-bottom: env(safe-area-inset-bottom, 0px);
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html, body {
  height: 100%;
  font-family: var(--font-family);
  background: var(--bg-primary);
  color: var(--text-primary);
  -webkit-font-smoothing: antialiased;
}

#app {
  height: 100%;
}

/* ==================== Screen Flash Animation (Mobile PWA) ==================== */
@keyframes screenFlash {
  0%, 100% { box-shadow: inset 0 0 0 0 transparent; }
  50% { box-shadow: inset 0 0 0 4px #FF3B30; }
}

.container.flash {
  animation: screenFlash 0.5s ease-out 2;
}

/* ==================== Layout ==================== */
.container {
  height: 100%;
  display: flex;
  flex-direction: column;
  max-width: 480px;
  margin: 0 auto;
  background: var(--bg-primary);
}

.screen {
  flex: 1;
  padding: 24px;
  display: flex;
  flex-direction: column;
}

.center {
  align-items: center;
  justify-content: center;
}

/* ==================== Login Screen ==================== */
.logo {
  font-size: 64px;
  margin-bottom: 16px;
  animation: float 3s ease-in-out infinite;
}

@keyframes float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-8px); }
}

.title {
  font-size: 36px;
  font-weight: 700;
  letter-spacing: -1px;
  margin-bottom: 4px;
  background: linear-gradient(135deg, var(--blue), #5856D6);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.subtitle {
  color: var(--text-secondary);
  font-size: 15px;
  margin-bottom: 32px;
}

.login-box {
  background: var(--bg-secondary);
  padding: 28px;
  border-radius: var(--radius-lg);
  width: 100%;
  max-width: 320px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.06);
}

.input-group {
  margin-bottom: 20px;
  text-align: left;
}

.input-group label {
  display: block;
  font-size: 13px;
  color: var(--text-secondary);
  margin-bottom: 8px;
  font-weight: 600;
}

.input-group input {
  width: 100%;
  padding: 14px 16px;
  border: 1px solid #E5E5EA;
  border-radius: var(--radius-sm);
  font-size: 16px;
  font-family: var(--font-family);
  outline: none;
  transition: all 0.2s;
  background: #F9F9F9;
  color: var(--text-primary);
  -webkit-text-fill-color: var(--text-primary);
}

.input-group input:focus {
  border-color: var(--blue);
  background: var(--bg-secondary);
}

.hint {
  color: var(--red);
  font-size: 13px;
  margin-top: 16px;
  text-align: center;
}

/* ==================== Buttons ==================== */
.btn-primary {
  width: 100%;
  background: #000000;
  color: #FFFFFF;
  padding: 16px;
  border: none;
  border-radius: var(--radius-sm);
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  font-family: var(--font-family);
  transition: all 0.2s;
}

.btn-primary:hover {
  background: #1C1C1E;
}

.btn-primary:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.btn-primary:active {
  transform: scale(0.98);
}

.btn-danger {
  background: rgba(255, 59, 48, 0.12);
  color: var(--red);
  border: none;
  padding: 8px 14px;
  border-radius: var(--radius-sm);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  font-family: var(--font-family);
  transition: all 0.2s;
}

.btn-danger:hover {
  background: rgba(255, 59, 48, 0.2);
}

.btn-text {
  background: none;
  border: none;
  color: var(--text-secondary);
  font-size: 15px;
  cursor: pointer;
  font-family: var(--font-family);
  margin-top: 16px;
}

.btn-text:hover {
  color: var(--text-primary);
}

/* ==================== Waiting Screen ==================== */
.waiting-animation {
  position: relative;
  width: 80px;
  height: 80px;
  margin-bottom: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.pulse-ring {
  position: absolute;
  width: 100%;
  height: 100%;
  border: 2px solid var(--blue);
  border-radius: 50%;
  opacity: 0;
  animation: pulse 2s ease-out infinite;
}

.pulse-ring.delay-1 { animation-delay: 0.6s; }
.pulse-ring.delay-2 { animation-delay: 1.2s; }

@keyframes pulse {
  0% { transform: scale(0.5); opacity: 1; }
  100% { transform: scale(1.5); opacity: 0; }
}

.loader {
  width: 32px;
  height: 32px;
  border: 3px solid #E5E5EA;
  border-top-color: var(--blue);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.status-text {
  color: var(--text-secondary);
  font-size: 15px;
}

/* ==================== Chat Screen ==================== */
.chat-screen {
  flex: 1;
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--bg-secondary);
}

.chat-header {
  padding: 12px 16px;
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-bottom: 0.5px solid rgba(0, 0, 0, 0.1);
  display: flex;
  justify-content: space-between;
  align-items: center;
  position: sticky;
  top: 0;
  z-index: 10;
}

.header-info {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 500;
}

.room-badge {
  background: #F2F2F7;
  padding: 4px 10px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}

.status-dot {
  width: 8px;
  height: 8px;
  background: var(--green);
  border-radius: 50%;
  animation: blink 2s ease-in-out infinite;
}

@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.messages {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.empty-messages {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
}

.bubble {
  max-width: 80%;
  padding: 10px 16px;
  border-radius: 18px;
  font-size: 16px;
  line-height: 1.4;
  word-wrap: break-word;
}

.bubble.me {
  align-self: flex-end;
  background: var(--bubble-mine);
  color: #FFFFFF;
  border-bottom-right-radius: 4px;
}

.bubble.them {
  align-self: flex-start;
  background: var(--bubble-theirs);
  color: var(--text-primary);
  border-bottom-left-radius: 4px;
}

.input-area {
  padding: 10px 16px;
  padding-bottom: calc(10px + var(--safe-area-bottom));
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-top: 0.5px solid rgba(0, 0, 0, 0.1);
  display: flex;
  gap: 10px;
  align-items: center;
}

.input-area input {
  flex: 1;
  background: var(--bg-primary);
  border: none;
  padding: 12px 18px;
  border-radius: var(--radius-full);
  font-size: 16px;
  font-family: var(--font-family);
  outline: none;
  color: var(--text-primary);
  -webkit-text-fill-color: var(--text-primary);
}

.input-area input::placeholder {
  color: var(--text-secondary);
}

.send-btn {
  padding: 10px 18px;
  border: none;
  background: var(--blue);
  color: #FFFFFF;
  border-radius: 20px;
  cursor: pointer;
  font-size: 15px;
  font-weight: 600;
  font-family: var(--font-family);
  transition: all 0.2s;
}

.send-btn:disabled {
  background: #C7C7CC;
  cursor: not-allowed;
}

.send-btn:not(:disabled):active {
  transform: scale(0.95);
}

/* ==================== Modal ==================== */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  padding: 24px;
}

.modal {
  background: var(--bg-secondary);
  border-radius: var(--radius-lg);
  padding: 32px 24px;
  text-align: center;
  max-width: 300px;
  width: 100%;
  animation: modalIn 0.3s ease;
}

@keyframes modalIn {
  from { opacity: 0; transform: scale(0.9); }
  to { opacity: 1; transform: scale(1); }
}

.modal-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.modal h3 {
  font-size: 20px;
  font-weight: 600;
  margin-bottom: 8px;
}

.modal p {
  color: var(--text-secondary);
  margin-bottom: 24px;
  font-size: 15px;
}

/* ==================== Settings Modal ==================== */
.settings-modal {
  text-align: left;
  padding: 20px;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.modal-header h3 {
  margin: 0;
}

.btn-close {
  background: none;
  border: none;
  font-size: 20px;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 4px 8px;
}

.btn-close:hover {
  color: var(--text-primary);
}

.settings-list {
  margin-bottom: 16px;
}

.setting-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 0;
  border-bottom: 1px solid #E5E5EA;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.setting-item:last-child {
  border-bottom: none;
}

.setting-item:active {
  background: #F2F2F7;
  margin: 0 -20px;
  padding: 14px 20px;
}

.setting-label {
  font-size: 16px;
}

.toggle {
  width: 50px;
  height: 30px;
  background: #E5E5EA;
  border-radius: 15px;
  position: relative;
  transition: all 0.3s;
}

.toggle::after {
  content: '';
  position: absolute;
  width: 26px;
  height: 26px;
  background: #fff;
  border-radius: 50%;
  top: 2px;
  left: 2px;
  transition: all 0.3s;
  box-shadow: 0 2px 4px rgba(0,0,0,0.2);
}

.toggle.active {
  background: var(--green);
}

.toggle.active::after {
  left: 22px;
}

.settings-note {
  color: var(--text-secondary);
  font-size: 13px;
  text-align: center;
  margin: 0;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.btn-icon {
  background: none;
  border: none;
  font-size: 20px;
  cursor: pointer;
  padding: 4px;
  opacity: 0.7;
  transition: opacity 0.2s;
}

.btn-icon:hover {
  opacity: 1;
}

/* ==================== Responsive ==================== */
@media (min-width: 481px) {
  .container {
    border-left: 1px solid #E5E5EA;
    border-right: 1px solid #E5E5EA;
  }
}
</style>
