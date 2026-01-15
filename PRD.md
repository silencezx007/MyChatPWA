# 产品需求文档 (PRD) - NiceTalk
**版本号**: v1.5.0  
**状态**: 已上线 (MVP + 迭代优化)  
**最后更新**: 2026-01-15  
**负责人**: AntiGravity (AI Agent) / User (Product Owner)

---

## 1. 产品概述 (Executive Summary)

### 1.1 产品愿景
**NiceTalk** 旨在打造一款**极致轻量、彻底隐私、无国界**的即时通讯工具。它拒绝繁琐的注册流程和持久化的社交关系，回归沟通本质——**此时此刻，连接你我**。

### 1.2 核心价值主张 (Value Proposition)
*   **零门槛 (Zero Friction)**：无需注册，输入“暗号”（房间号+密码）即刻开聊。
*   **阅后即焚 (Ephemeral)**：房间销毁即数据物理擦除，不留任何云端痕迹。
*   **全网通达 (Global Accessibility)**：独创的双栈架构，智能突破网络封锁，确保国内外用户无缝直连。
*   **原生体验 (Native-like)**：基于 PWA 技术，提供媲美原生 App 的视觉交互与离线能力，却无需下载安装包。

---

## 2. 用户画像 (User Personas)
*   **极客与技术爱好者**：注重隐私，偏好开源和透明的技术方案，反感传统 IM 的臃肿。
*   **临时协作小组**：需要快速搭建临时沟通渠道（如活动现场、临时项目），任务结束即散伙。
*   **跨国沟通者**：经常面临网络环境不稳定或访问受限问题，需要一个稳定可靠的备用联系方式。

---

## 3. 功能需求 (Functional Requirements)

### 3.1 认证与连接 (Auth & Connectivity)
*   **[P0] 匿名房间机制**：
    *   用户需输入 `RoomID` (VIP) 和 `Password` (Code) 进行配对。
    *   如果房间不存在：自动创建新房间，不仅是聊天室，更是“频道”的建立者。
    *   如果房间存在：校验密码，均通过后进入；支持最大 2 人即时私聊（未来可扩展）。
*   **[P0] 智能双栈架构 (Dual-Stack Architecture)**：
    *   **主线路 (Firebase)**：利用 Google 基础设施，为海外用户提供毫秒级同步。
    *   **容灾线路 (Supabase + Cloudflare)**：
        *   系统启动时自动探测网络环境或读取 GitHub 远程配置。
        *   若 Firebase 不可达，自动无感切换至 Cloudflare Worker 代理的 Supabase 链路。
        *   **价值**：解决“墙”的问题，实现真正的无国界沟通。

### 3.2 消息与交互 (Messaging & Interaction)
*   **[P0] 实时文本通讯**：支持极速文本收发，打字机般的流畅体验。
*   **[P1] 房间销毁 (Self-Destruct)**：
    *   用户可主动点击“销毁”，触发服务端逻辑。
    *   **硬删除**：立即物理删除数据库中的所有消息记录和房间信息，不可恢复。
    *   **多端同步**：对方界面同步弹出“房间已销毁”提示并强制退出，确保隐私闭环。
*   **[P1] 房间自动过期**：创建房间后默认 10 分钟有效期，超时自动清理，防止资源滥用。

### 3.3 通知与唤醒 (Notifications & Wake-up)
*   **[P1] 多维感官反馈**：
    *   **视觉**：Tab 标题闪烁 (`● 新消息`)、Favicon 红点动态绘制、移动端屏幕边缘闪烁 (Flash Screen)。
    *   **听觉**：清脆悦耳的消息提示音 (Web Audio API)。
    *   **触觉**：手机端振动反馈 (Vibration API)。
*   **[P1] iOS 后台保活 (Keep-Alive)**：
    *   利用播放静音音频 (`silent.mp3`) 欺骗 iOS 后台机制，防止 PWA 切后台后 WebSocket 断连。
    *   锁屏组件显示“保持后台连接”，明确告知用户运行状态。

---

## 4. 用户体验与设计 (UX/UI Requirements)

### 4.1 设计语言
*   **风格**: Modern Clean / Glassmorphism (毛玻璃)
*   **色调**: 科技蓝 (`#007AFF`) 与 警示红 (`#FF3B30`) 的经典搭配。
*   **动效**: 需要具备原生 iOS 般的丝滑转场（如 Bubble 弹出、页面切换），拒绝 Web 页面的生硬感。

### 4.2 关键交互
*   **等待动画**: “...天边...眼前”，用诗意的文案缓解用户等待焦虑。
*   **设置通过**: 允许用户自定义开关声音、振动、闪烁，尊重用户偏好。

---

## 5. 技术架构 (Technical Specifications)

### 5.1 前端栈
*   **Framework**: Vue 3 (Composition API) + Vite
*   **PWA**: `vite-plugin-pwa`，支持添加到主屏幕 (A2HS)，离线缓存。
*   **Language**: JavaScript (ES6+)

### 5.2 后端服务 (Serverless)
*   **Storage & Realtime**: 
    1.  **Google Firebase Firestore** (NoSQL, Default)
    2.  **Supabase** (PostgreSQL, Proxy mode)
*   **Edge Network**: Cloudflare Workers (用于 API 代理及跨域处理)。
*   **Config Host**: GitHub Pages (用于托管 `proxy-config.json` 动态开关)。

---

## 6. 路线图 (Roadmap)

### Phase 1: MVP (Completed)
*   [x] 基础聊天功能
*   [x] Firebase 集成
*   [x] 基础 PWA 安装

### Phase 2: User Experience (Completed)
*   [x] 消息通知 (声音/振动/标题)
*   [x] iOS 后台保活方案
*   [x] UI/UX 升级 (Glassmorphism)

### Phase 3: Accessibility & Stability (Current)
*   [x] **Supabase 数据库迁移与双栈灾备**
*   [x] Cloudflare 代理接入
*   [x] 国内网络无法访问问题的彻底解决

### Phase 4: Future
*   [ ] **多媒体消息**：支持图片阅后即焚（需考虑存储成本与鉴黄）。
*   [ ] **端对端加密 (E2EE)**：在浏览器端混淆消息内容，服务器仅存储密文，实现极致安全。
*   [ ] **多人会议模式**：扩展至 3 人以上群聊。

---

## 7. 附录：数据安全声明
我们承诺：NiceTalk **不存储**任何用户密码明文，**不保留**任何历史聊天日志。所有数据存储于内存或临时数据库记录中，一旦会话结束或用户主动销毁，并在技术上不可恢复。
