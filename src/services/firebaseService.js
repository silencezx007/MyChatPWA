import { db, auth } from '../firebase';
import { signInAnonymously } from "firebase/auth";
import {
    collection, doc, setDoc, getDoc, getDocs, updateDoc, deleteDoc, onSnapshot,
    serverTimestamp, query, orderBy, arrayUnion, writeBatch
} from "firebase/firestore";

export const firebaseService = {
    async init() {
        const userCred = await signInAnonymously(auth);
        return userCred.user.uid;
    },

    async joinOrCreateRoom(roomId, password, userId) {
        const roomRef = doc(db, 'rooms', roomId);
        const docSnap = await getDoc(roomRef);

        if (docSnap.exists()) {
            const data = docSnap.data();

            // 检查过期
            if (data.expiresAt && data.expiresAt.toDate() < new Date()) {
                await this.destroyRoom(roomId); // 逻辑简化：过期直接销毁重建
                return this.createRoom(roomId, password, userId);
            }

            if (data.password !== password) throw new Error('密码错误');
            if (data.participants.length >= 2 && !data.participants.includes(userId)) {
                throw new Error('房间已满');
            }

            if (!data.participants.includes(userId)) {
                await updateDoc(roomRef, {
                    participants: arrayUnion(userId),
                    status: 'active'
                });
            }
        } else {
            await this.createRoom(roomId, password, userId);
        }
    },

    async createRoom(roomId, password, userId) {
        await setDoc(doc(db, 'rooms', roomId), {
            roomId,
            password,
            participants: [userId],
            createdAt: serverTimestamp(),
            expiresAt: new Date(Date.now() + 10 * 60 * 1000),
            status: 'waiting'
        });
    },

    async leaveRoom(roomId, userId) {
        // Firebase implementation: usually just delete doc if last user, or here we delete strictly
        try {
            await deleteDoc(doc(db, 'rooms', roomId));
        } catch (e) {
            console.error(e);
        }
    },

    async destroyRoom(roomId) {
        const batch = writeBatch(db);
        const messagesRef = collection(db, `rooms/${roomId}/messages`);
        const snapshot = await getDocs(messagesRef);
        snapshot.docs.forEach((doc) => batch.delete(doc.ref));
        batch.delete(doc(db, 'rooms', roomId));
        await batch.commit();
    },

    async sendMessage(roomId, text, senderId) {
        await setDoc(doc(collection(db, `rooms/${roomId}/messages`)), {
            text,
            sender: senderId,
            createdAt: serverTimestamp()
        });
    },

    onRoomUpdate(roomId, callback) {
        return onSnapshot(doc(db, 'rooms', roomId), callback);
    },

    onMessageUpdate(roomId, callback) {
        const q = query(collection(db, `rooms/${roomId}/messages`), orderBy('createdAt'));
        return onSnapshot(q, callback);
    }
};
