import request, { BASE_URL } from '../utils/request';

function getConversations() {
    return request({
        url: '/agent/conversations',
        method: 'GET'
    });
}

function createConversation(data) {
    return request({
        url: '/agent/conversations',
        method: 'POST',
        data
    });
}

function deleteConversation(id) {
    return request({
        url: `/agent/conversations/${id}`,
        method: 'DELETE'
    });
}

function getChatHistory(id) {
    return request({
        url: `/agent/conversations/${id}/history`,
        method: 'GET'
    }).then(res => {
        return res?.list || res || [];
    });
}

function approveAction(conversationId, actionId, data) {
    return request({
        url: `/agent/sessions/${conversationId}/actions/${actionId}/approve`,
        method: 'POST',
        data
    });
}

function rejectAction(conversationId, actionId) {
    return request({
        url: `/agent/sessions/${conversationId}/actions/${actionId}/reject`,
        method: 'POST'
    });
}

function createUtf8Decoder() {
    let buffer = [];
    return function decode(chunkBytes) {
        for (let i = 0; i < chunkBytes.length; i++) {
            buffer.push(chunkBytes[i]);
        }
        
        let i = 0;
        let str = '';
        while (i < buffer.length) {
            const c = buffer[i];
            let bytesNeeded = 0;
            let codePoint = 0;
            
            if (c < 0x80) {
                bytesNeeded = 1;
                codePoint = c;
            } else if ((c & 0xE0) === 0xC0) {
                bytesNeeded = 2;
                codePoint = c & 0x1F;
            } else if ((c & 0xF0) === 0xE0) {
                bytesNeeded = 3;
                codePoint = c & 0x0F;
            } else if ((c & 0xF8) === 0xF0) {
                bytesNeeded = 4;
                codePoint = c & 0x07;
            } else {
                i++;
                continue;
            }
            
            if (i + bytesNeeded > buffer.length) {
                break;
            }
            
            i++;
            for (let j = 1; j < bytesNeeded; j++) {
                const nextByte = buffer[i++];
                codePoint = (codePoint << 6) | (nextByte & 0x3F);
            }
            
            if (codePoint <= 0xFFFF) {
                str += String.fromCharCode(codePoint);
            } else {
                const u = codePoint - 0x10000;
                str += String.fromCharCode(0xD800 + (u >> 10), 0xDC00 + (u & 1023));
            }
        }
        
        buffer = buffer.slice(i);
        return str;
    };
}

function chatStream(data, onChunk, onDone, onError) {
    const token = uni.getStorageSync('token');
    const header = {
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream'
    };
    if (token) {
        header.Authorization = `Bearer ${token}`;
    }

    let hasReceivedChunk = false;

    const requestTask = uni.request({
        url: `${BASE_URL}/agent/chat/stream`,
        method: 'POST',
        header,
        data: {
            conversation_id: data.conversation_id,
            message: data.message,
            mode: data.mode || 'auto',
            pay_type: data.pay_type || '',
            payment_password: data.payment_password || '',
            face_image_url: data.face_image_url || ''
        },
        enableChunked: true,
        responseType: 'arraybuffer',
        success: (res) => {
            if (res.statusCode !== 200) {
                onError(new Error(`请求失败 (状态码: ${res.statusCode})`));
                return;
            }
            
            // Fallback for buffered response:
            // If onChunkReceived was never called (e.g. not supported or no chunks received),
            // parse the full response body accumulated in res.data
            if (!hasReceivedChunk && res.data) {
                let text = '';
                if (res.data instanceof ArrayBuffer) {
                    const fallbackDecoder = createUtf8Decoder();
                    text = fallbackDecoder(new Uint8Array(res.data));
                } else if (typeof res.data === 'string') {
                    text = res.data;
                }
                
                if (text) {
                    const lines = text.split('\n');
                    for (const line of lines) {
                        const cleaned = line.trim();
                        if (!cleaned) continue;
                        if (cleaned.startsWith('data: ')) {
                            const content = cleaned.slice(6);
                            if (content === '[DONE]') continue;
                            try {
                                const parsed = JSON.parse(content);
                                onChunk(parsed);
                            } catch (e) {}
                        }
                    }
                }
            }
            
            onDone();
        },
        fail: (err) => {
            onError(err || new Error('网络请求异常'));
        }
    });

    const utf8Decoder = createUtf8Decoder();
    let lineBuffer = '';

    if (typeof requestTask.onChunkReceived === 'function') {
        requestTask.onChunkReceived((chunk) => {
            try {
                if (!chunk || !chunk.data) return;
                hasReceivedChunk = true;
                
                let bytes;
                if (typeof chunk.data === 'string') {
                    if (typeof TextEncoder === 'function') {
                        bytes = new TextEncoder().encode(chunk.data);
                    } else {
                        bytes = unescape(encodeURIComponent(chunk.data)).split('').map(c => c.charCodeAt(0));
                    }
                } else {
                    bytes = new Uint8Array(chunk.data);
                }
                
                const decodedText = utf8Decoder(bytes);
                lineBuffer += decodedText;
                const lines = lineBuffer.split('\n');
                lineBuffer = lines.pop(); // Keep remaining incomplete line

                for (const line of lines) {
                    const cleaned = line.trim();
                    if (!cleaned) continue;

                    if (cleaned.startsWith('data: ')) {
                        const content = cleaned.slice(6);
                        if (content === '[DONE]') {
                            onDone();
                            return;
                        }
                        if (content.startsWith('[ERROR]')) {
                            onError(new Error(content.slice(8)));
                            try {
                                requestTask.abort();
                            } catch (e) {}
                            return;
                        }
                        try {
                            const parsed = JSON.parse(content);
                            onChunk(parsed);
                        } catch (e) {
                            console.error('Error parsing stream chunk:', e);
                        }
                    }
                }
            } catch (e) {
                console.error('Error in onChunkReceived:', e);
                onError(e);
            }
        });
    } else {
        console.warn('uni.request enableChunked is not supported on this platform');
    }

    return requestTask;
}

export default {
    getConversations,
    createConversation,
    deleteConversation,
    getChatHistory,
    approveAction,
    rejectAction,
    chatStream
};
