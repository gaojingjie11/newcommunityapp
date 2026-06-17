import request, { BASE_URL } from '../utils/request';

async function getOrCreateConversationId() {
    let conversationId = uni.getStorageSync('chat_conversation_id');
    if (!conversationId) {
        try {
            const listRes = await request({
                url: '/agent/conversations',
                method: 'GET'
            });
            const list = Array.isArray(listRes) ? listRes : (listRes?.list || []);
            if (list.length > 0) {
                conversationId = list[0].id;
            } else {
                const createRes = await request({
                    url: '/agent/conversations',
                    method: 'POST',
                    data: { title: 'App AI 助手' }
                });
                conversationId = createRes?.id;
            }
            if (conversationId) {
                uni.setStorageSync('chat_conversation_id', conversationId);
            }
        } catch (e) {
            console.error('Failed to get or create conversation:', e);
            throw e;
        }
    }
    return conversationId;
}

export default {
    async getChatHistory(params) {
        const conversationId = await getOrCreateConversationId();
        if (!conversationId) {
            return { list: [] };
        }
        return request({
            url: `/agent/conversations/${conversationId}/history`,
            method: 'GET',
            data: params
        });
    },

    async sendChat(data) {
        const conversationId = await getOrCreateConversationId();
        if (!conversationId) {
            throw new Error('未创建有效的对话 Session');
        }

        const token = uni.getStorageSync('token');
        // Construct the stream URL from request's BASE_URL (replacing or appending appropriately)
        const streamUrl = `${BASE_URL}/agent/chat/stream`;

        const response = await fetch(streamUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': token ? `Bearer ${token}` : ''
            },
            body: JSON.stringify({
                conversation_id: conversationId,
                message: data.content,
                mode: 'auto',
                pay_type: 'password',
                payment_password: data.payment_password || '',
                face_image_url: data.face_image_url || ''
            })
        });

        if (!response.ok) {
            const text = await response.text();
            let errorMsg = 'AI 请求失败';
            try {
                const parsed = JSON.parse(text);
                errorMsg = parsed.message || parsed.msg || errorMsg;
            } catch (e) {
                errorMsg = text || errorMsg;
            }
            throw new Error(errorMsg);
        }

        let replyText = '';
        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let buffer = '';

        while (true) {
            const { value, done } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop(); // keep partial line in buffer

            for (const line of lines) {
                const cleaned = line.trim();
                if (!cleaned) continue;

                if (cleaned.startsWith('data: ')) {
                    const content = cleaned.slice(6);
                    if (content === '[DONE]') {
                        break;
                    }
                    if (content.startsWith('[ERROR]')) {
                        throw new Error(content.slice(8));
                    }
                    try {
                        const parsed = JSON.parse(content);
                        if (parsed && parsed.type === 'message_delta' && parsed.data && parsed.data.chunk) {
                            replyText += parsed.data.chunk;
                        } else if (parsed && parsed.chunk) {
                            replyText += parsed.chunk;
                        }
                    } catch (e) {
                        console.error('Error parsing stream chunk:', e);
                    }
                }
            }
        }

        return {
            reply: replyText
        };
    }
};
