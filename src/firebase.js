// Firebase v9 模块化 SDK 配置
// 请在 Firebase Console 创建项目后，将下面的 firebaseConfig 替换为你的实际配置
// https://console.firebase.google.com

import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth'

// SecretTalk Firebase 配置
const firebaseConfig = {
  apiKey: "AIzaSyDmZvNb4c8vYU6D3xgPxvGrXwDkdnAkQco",
  authDomain: "secretalk-ec8bb.firebaseapp.com",
  projectId: "secretalk-ec8bb",
  storageBucket: "secretalk-ec8bb.firebasestorage.app",
  messagingSenderId: "652047176963",
  appId: "1:652047176963:web:d1b6f9302d1377a4434536"
}

// 初始化 Firebase
const app = initializeApp(firebaseConfig)

// 初始化 Firestore
export const db = getFirestore(app)

// 初始化 Auth
export const auth = getAuth(app)

// 匿名登录
export const loginAnonymously = () => {
  return signInAnonymously(auth)
}

// 监听认证状态变化
export const onAuthChange = (callback) => {
  return onAuthStateChanged(auth, callback)
}
