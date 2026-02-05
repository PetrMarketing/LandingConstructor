/**
 * MAX Messenger Bot API Integration
 * API Documentation: https://love-apples.github.io/maxapi/
 */

const MAX_API_BASE = 'https://botapi.max.ru';

class MaxApi {
    constructor(token) {
        this.token = token;
        this.baseUrl = MAX_API_BASE;
    }

    async request(method, endpoint, data = null) {
        const url = `${this.baseUrl}${endpoint}?access_token=${this.token}`;

        const options = {
            method,
            headers: {
                'Content-Type': 'application/json'
            }
        };

        if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
            options.body = JSON.stringify(data);
        }

        try {
            const response = await fetch(url, options);
            const result = await response.json();

            if (!response.ok) {
                console.error('[MAX API] Error:', result);
                return { success: false, error: result.message || 'API Error' };
            }

            return { success: true, data: result };
        } catch (error) {
            console.error('[MAX API] Request failed:', error.message);
            return { success: false, error: error.message };
        }
    }

    // Получить информацию о боте
    async getMe() {
        return this.request('GET', '/me');
    }

    // Получить информацию о чате/канале по ID
    async getChat(chatId) {
        return this.request('GET', `/chats/${chatId}`);
    }

    // Получить информацию о чате/канале по ссылке
    async getChatByLink(link) {
        return this.request('GET', `/chats`, { link });
    }

    // Получить список чатов бота
    async getChats(count = 50, marker = null) {
        const params = { count };
        if (marker) params.marker = marker;
        return this.request('GET', '/chats', params);
    }

    // Отправить сообщение
    async sendMessage(chatId, text, attachments = null) {
        const data = { text };
        if (attachments) data.attachments = attachments;
        return this.request('POST', `/chats/${chatId}/messages`, data);
    }

    // Получить участников чата
    async getChatMembers(chatId, count = 100, marker = null) {
        const params = { count };
        if (marker) params.marker = marker;
        return this.request('GET', `/chats/${chatId}/members`, params);
    }

    // Подписаться на вебхук
    async subscribeWebhook(url, updateTypes = null) {
        const data = { url };
        if (updateTypes) data.update_types = updateTypes;
        return this.request('POST', '/subscriptions', data);
    }

    // Отписаться от вебхука
    async unsubscribeWebhook(url) {
        return this.request('DELETE', '/subscriptions', { url });
    }

    // Получить подписки
    async getSubscriptions() {
        return this.request('GET', '/subscriptions');
    }

    // Получить обновления (polling)
    async getUpdates(limit = 100, timeout = 30, marker = null, types = null) {
        const params = { limit, timeout };
        if (marker) params.marker = marker;
        if (types) params.types = types;
        return this.request('GET', '/updates', params);
    }
}

// Singleton instance
let maxApiInstance = null;

function getMaxApi() {
    if (!maxApiInstance && process.env.MAX_BOT_TOKEN) {
        maxApiInstance = new MaxApi(process.env.MAX_BOT_TOKEN);
    }
    return maxApiInstance;
}

function initMaxApi(token) {
    maxApiInstance = new MaxApi(token);
    return maxApiInstance;
}

module.exports = { MaxApi, getMaxApi, initMaxApi };
