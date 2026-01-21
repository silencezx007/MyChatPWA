import { createClient } from '@supabase/supabase-js';
import { AUTH_CONFIG } from '../authConfig';

// 使用 Proxy URL 初始化
const supabase = createClient(AUTH_CONFIG.SUPABASE_PROXY_URL, AUTH_CONFIG.SUPABASE_ANON_KEY);

export const supabaseService = {
    async init() {
        // 1. Try existing session
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) return session.user.id;

        // 2. Try anonymous sign-in (requires Supabase project to enable "Allow anonymous sign-ins")
        try {
            const { data, error } = await supabase.auth.signInAnonymously();
            if (!error && data?.user) {
                console.log('Supabase anonymous login success:', data.user.id);
                return data.user.id;
            }
        } catch (e) {
            console.warn('Supabase anonymous auth failed:', e);
        }

        // 3. Fallback: Generate local UUID (for RLS policies allowing anon key access)
        let localId = localStorage.getItem('nicetalk_anon_id');
        if (!localId) {
            localId = 'anon_' + crypto.randomUUID();
            localStorage.setItem('nicetalk_anon_id', localId);
        }
        console.log('Using local anonymous ID:', localId);
        return localId;
    },

    async joinOrCreateRoom(roomId, password, userId) {
        // 1. Check if room exists
        const { data: room, error } = await supabase
            .from('rooms')
            .select('*')
            .eq('room_id', roomId)
            .single();

        if (error && error.code !== 'PGRST116') { // PGRST116 is "not found"
            throw error;
        }

        if (room) {
            // 检查过期
            if (new Date(room.expires_at) < new Date()) {
                await this.destroyRoom(roomId);
                return this.createRoom(roomId, password, userId);
            }

            if (room.password !== password) throw new Error('密码错误');
            if (room.participants.length >= 2 && !room.participants.includes(userId)) {
                throw new Error('房间已满');
            }

            // Join
            if (!room.participants.includes(userId)) {
                const newParticipants = [...room.participants, userId];
                await supabase
                    .from('rooms')
                    .update({
                        participants: newParticipants,
                        status: 'active'
                    })
                    .eq('room_id', roomId);
            }
        } else {
            await this.createRoom(roomId, password, userId);
        }
    },

    async createRoom(roomId, password, userId) {
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
        const { error } = await supabase
            .from('rooms')
            .insert({
                room_id: roomId,
                password: password,
                participants: [userId],
                status: 'waiting',
                expires_at: expiresAt
            });

        if (error) throw error;
    },

    async leaveRoom(roomId, userId) {
        const { error } = await supabase
            .from('rooms')
            .delete()
            .eq('room_id', roomId);
        if (error) console.error(error);
    },

    async destroyRoom(roomId) {
        // Cascade delete should handle messages, but let's be explicit if needed
        // Assuming 'on delete cascade' in SQL FK
        const { error } = await supabase
            .from('rooms')
            .delete()
            .eq('room_id', roomId);
        if (error) console.error(error);
    },

    async sendMessage(roomId, text, senderId) {
        const { error } = await supabase
            .from('messages')
            .insert({
                room_id: roomId,
                text: text,
                sender: senderId
            });
        if (error) throw error;
    },

    // Realtime Listeners
    onRoomUpdate(roomId, callback) {
        // Returns an object containing { exists: bool, data: ... } to match Firebase snapshot shape logic
        // OR adapter logic. Here we map to a custom object.

        // 1. Initial Fetch
        supabase
            .from('rooms')
            .select('*')
            .eq('room_id', roomId)
            .single()
            .then(({ data, error }) => {
                if (!error && data) {
                    callback({
                        exists: () => true,
                        data: () => ({ ...data, createdAt: new Date(data.created_at) })
                    });
                } else callback({ exists: () => false });
            });

        // 2. Subscribe
        const channel = supabase
            .channel(`room:${roomId}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms', filter: `room_id=eq.${roomId}` }, (payload) => {
                if (payload.eventType === 'DELETE') {
                    callback({ exists: () => false });
                } else {
                    const newData = payload.new;
                    callback({
                        exists: () => true,
                        data: () => ({ ...newData, createdAt: new Date(newData.created_at) })
                    });
                }
            })
            .subscribe();

        return () => supabase.removeChannel(channel);
    },

    onMessageUpdate(roomId, callback) {
        // Strategy: Fetch all first? Or just listen?
        // User wants chat history if just joined? Typically yes.

        // Initial fetch
        supabase
            .from('messages')
            .select('*')
            .eq('room_id', roomId)
            .order('created_at', { ascending: true })
            .then(({ data }) => {
                if (data) {
                    // Transform to match structure expected by UI { id, ...data }
                    const docs = data.map(m => ({ id: m.id, ...m, createdAt: new Date(m.created_at) }));
                    callback({ docs });
                }
            });

        const channel = supabase
            .channel(`messages:${roomId}`)
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `room_id=eq.${roomId}` }, (payload) => {
                // We need to fetch the full list or append?
                // App.vue expects a full snapshot or a handling logic.
                // Firebase onSnapshot returns the whole query result usually or changes.
                // Simplified: Re-fetch all or Append.
                // To strictly match Firebase 'onSnapshot' behavior which returns 'docs' array:

                // Optimization: Just append in UI? Adapter layer complexity.
                // For now, let's just Re-fetch all to keep it simple and robust.
                supabase
                    .from('messages')
                    .select('*')
                    .eq('room_id', roomId)
                    .order('created_at', { ascending: true })
                    .then(({ data }) => {
                        const docs = data.map(m => ({ id: m.id, ...m, createdAt: new Date(m.created_at) }));
                        callback({ docs });
                    });
            })
            .subscribe();

        return () => supabase.removeChannel(channel);
    }
};
