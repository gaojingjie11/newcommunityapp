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

function arrayBufferToString(buffer) {
    if (!buffer) return '';
    const array = new Uint8Array(buffer);
    let out = "";
    let len = array.length;
    let i = 0;
    let c, char2, char3;

    while (i < len) {
        c = array[i++];
        switch (c >> 4) {
            case 0: case 1: case 2: case 3: case 4: case 5: case 6: case 7:
                // 0xxxxxxx
                out += String.fromCharCode(c);
                break;
            case 12: case 13:
                // 110x xxxx   10xx xxxx
                char2 = array[i++];
                out += String.fromCharCode(((c & 0x1F) << 6) | (char2 & 0x3F));
                break;
            case 14:
                // 1110 xxxx  10xx xxxx  10xx xxxx
                char2 = array[i++];
                char3 = array[i++];
                out += String.fromCharCode(((c & 0x0F) << 12) |
                               ((char2 & 0x3F) << 6) |
                               ((char3 & 0x3F) << 0));
                break;
        }
    }
    return out;
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

    sendChat(data) {
        return new Promise(async (resolve, reject) => {
            let conversationId;
            try {
                conversationId = await getOrCreateConversationId();
            } catch (e) {
                reject(e);
                return;
            }

            if (!conversationId) {
                reject(new Error('未创建有效的对话 Session'));
                return;
            }

            const token = uni.getStorageSync('token');
            const streamUrl = `${BASE_URL}/agent/chat/stream`;

            let replyText = '';
            let buffer = '';

            const requestTask = uni.request({
                url: streamUrl,
                method: 'POST',
                header: {
                    'Content-Type': 'application/json',
                    'Authorization': token ? `Bearer ${token}` : ''
                },
                data: {
                    conversation_id: conversationId,
                    message: data.content,
                    mode: 'auto',
                    pay_type: 'password',
                    payment_password: data.payment_password || '',
                    face_image_url: data.face_image_url || ''
                },
                enableChunked: true,
                success: (res) => {
                    resolve({ reply: replyText });
                },
                fail: (err) => {
                    reject(err || new Error('AI 请求失败'));
                }
            });

            if (typeof requestTask.onChunkReceived === 'function') {
                requestTask.onChunkReceived((chunkRes) => {
                    const chunkStr = arrayBufferToString(chunkRes.data);
                    buffer += chunkStr;
                    
                    const lines = buffer.split('\n');
                    buffer = lines.pop(); // keep partial line in buffer

                    for (const line of lines) {
                        const cleaned = line.trim();
                        if (!cleaned) continue;

                        if (cleaned.startsWith('data: ')) {
                            const content = cleaned.slice(6);
                            if (content === '[DONE]') {
                                continue;
                            }
                            if (content.startsWith('[ERROR]')) {
                                reject(new Error(content.slice(8)));
                                try {
                                    requestTask.abort();
                                } catch(e){}
                                return;
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
                });
            } else {
                // Fallback for environments where chunked transfer is not supported
                // We let requestTask do a standard call if it doesn't support chunked events
                // Note: The backend is text/event-stream, standard request might not resolve properly,
                // but this acts as an interface safeguard.
                console.warn('uni.request enableChunked is not supported on this platform');
            }
        });
    }
};
