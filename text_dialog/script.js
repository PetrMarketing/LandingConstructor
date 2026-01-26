// ===== Chat with AI - OpenRouter =====

// Config
const CONFIG = {
    apiKey: localStorage.getItem('openrouter_api_key') || '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',
    model: localStorage.getItem('openrouter_model') || 'google/gemini-2.0-flash-001',
    temperature: parseFloat(localStorage.getItem('openrouter_temperature') || '0.7'),
    apiUrl: 'https://openrouter.ai/api/v1/chat/completions'
};

// State
let chatHistory = [];
let chats = JSON.parse(localStorage.getItem('ai_chats') || '[]');
let currentChatId = null;

// DOM Elements
const messagesContainer = document.getElementById('messagesContainer');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const chatList = document.getElementById('chatList');
const chatTitle = document.getElementById('chatTitle');
const settingsModal = document.getElementById('settingsModal');

// ===== API =====
async function sendToOpenRouter(message, retryCount = 0) {
    if (!CONFIG.apiKey) {
        throw new Error('API ключ не установлен. Откройте настройки.');
    }

    // Build conversation history for context (OpenAI format)
    const messages = chatHistory.map(msg => ({
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: msg.content
    }));

    // Add current message
    messages.push({
        role: 'user',
        content: message
    });

    const response = await fetch(CONFIG.apiUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${CONFIG.apiKey}`,
            'HTTP-Referer': window.location.href,
            'X-Title': 'AI Chat'
        },
        body: JSON.stringify({
            model: CONFIG.model,
            messages: messages,
            temperature: CONFIG.temperature,
            max_tokens: 2048
        })
    });

    if (!response.ok) {
        const error = await response.json();
        const errorMsg = error.error?.message || '';

        // Handle rate limit - retry after waiting
        if (response.status === 429 && retryCount < 3) {
            const waitTime = 30;
            showRetryCountdown(waitTime);
            await new Promise(resolve => setTimeout(resolve, waitTime * 1000));
            return sendToOpenRouter(message, retryCount + 1);
        }

        // User-friendly error messages
        if (errorMsg.includes('quota') || errorMsg.includes('rate') || errorMsg.includes('limit')) {
            throw new Error('Превышен лимит запросов. Подождите минуту.');
        }
        if (errorMsg.includes('credit') || errorMsg.includes('balance')) {
            throw new Error('Недостаточно кредитов на аккаунте OpenRouter.');
        }

        throw new Error(errorMsg || `API Error: ${response.status}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
}

function showRetryCountdown(seconds) {
    const loader = sendBtn.querySelector('.loading-icon');
    let remaining = seconds;

    const interval = setInterval(() => {
        loader.textContent = `⏳ ${remaining}с`;
        remaining--;
        if (remaining < 0) {
            clearInterval(interval);
            loader.textContent = '⏳';
        }
    }, 1000);
}

// ===== UI Functions =====
function addMessage(role, content) {
    const welcomeMsg = messagesContainer.querySelector('.welcome-message');
    if (welcomeMsg) welcomeMsg.remove();

    const time = new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

    const messageEl = document.createElement('div');
    messageEl.className = `message ${role}`;
    messageEl.innerHTML = `
        <div class="message-content">${formatMessage(content)}</div>
        <div class="message-time">${time}</div>
    `;

    messagesContainer.appendChild(messageEl);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    // Save to history
    chatHistory.push({ role, content, time });
    saveCurrentChat();
}

function formatMessage(text) {
    // Basic markdown-like formatting
    return text
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/`(.*?)`/g, '<code>$1</code>')
        .replace(/\n/g, '<br>');
}

function setLoading(loading) {
    sendBtn.disabled = loading;
    sendBtn.querySelector('.send-icon').style.display = loading ? 'none' : 'block';
    sendBtn.querySelector('.loading-icon').style.display = loading ? 'block' : 'none';
    messageInput.disabled = loading;
}

// ===== Chat Management =====
function createNewChat() {
    currentChatId = Date.now().toString();
    chatHistory = [];
    chatTitle.textContent = 'Новый чат';

    messagesContainer.innerHTML = `
        <div class="welcome-message">
            <div class="welcome-icon">🤖</div>
            <h2>Привет! Я AI-ассистент</h2>
            <p>Задайте мне любой вопрос, и я постараюсь помочь.</p>
        </div>
    `;

    renderChatList();
}

function saveCurrentChat() {
    if (!currentChatId || chatHistory.length === 0) return;

    const existingIndex = chats.findIndex(c => c.id === currentChatId);
    const chatData = {
        id: currentChatId,
        title: chatHistory[0]?.content.slice(0, 30) + '...' || 'Новый чат',
        history: chatHistory,
        date: new Date().toLocaleDateString('ru-RU')
    };

    if (existingIndex >= 0) {
        chats[existingIndex] = chatData;
    } else {
        chats.unshift(chatData);
    }

    localStorage.setItem('ai_chats', JSON.stringify(chats));
    renderChatList();
}

function loadChat(chatId) {
    const chat = chats.find(c => c.id === chatId);
    if (!chat) return;

    currentChatId = chatId;
    chatHistory = chat.history;
    chatTitle.textContent = chat.title;

    messagesContainer.innerHTML = '';
    chatHistory.forEach(msg => {
        const messageEl = document.createElement('div');
        messageEl.className = `message ${msg.role}`;
        messageEl.innerHTML = `
            <div class="message-content">${formatMessage(msg.content)}</div>
            <div class="message-time">${msg.time}</div>
        `;
        messagesContainer.appendChild(messageEl);
    });

    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    renderChatList();
}

function renderChatList() {
    const newChatBtn = chatList.querySelector('.new-chat-btn');
    chatList.innerHTML = '';
    chatList.appendChild(newChatBtn);

    chats.forEach(chat => {
        const chatItem = document.createElement('div');
        chatItem.className = `chat-item ${chat.id === currentChatId ? 'active' : ''}`;
        chatItem.innerHTML = `
            <div class="chat-item-title">${chat.title}</div>
            <div class="chat-item-date">${chat.date}</div>
        `;
        chatItem.addEventListener('click', () => loadChat(chat.id));
        chatList.appendChild(chatItem);
    });
}

function clearChat() {
    if (!confirm('Очистить текущий чат?')) return;
    createNewChat();
}

// ===== Send Message =====
async function sendMessage() {
    const message = messageInput.value.trim();
    if (!message) return;

    // Check API key
    if (!CONFIG.apiKey) {
        settingsModal.classList.add('active');
        return;
    }

    messageInput.value = '';
    messageInput.style.height = 'auto';

    // Add user message
    addMessage('user', message);

    // Send to API
    setLoading(true);
    try {
        const response = await sendToOpenRouter(message);
        addMessage('assistant', response);
    } catch (error) {
        console.error('Error:', error);
        addMessage('assistant', `❌ Ошибка: ${error.message}`);
    } finally {
        setLoading(false);
        messageInput.focus();
    }
}

// ===== Settings =====
function loadSettings() {
    document.getElementById('apiKeyInput').value = CONFIG.apiKey;
    document.getElementById('modelSelect').value = CONFIG.model;
    document.getElementById('temperatureInput').value = CONFIG.temperature;
    document.getElementById('temperatureValue').textContent = CONFIG.temperature;
}

function saveSettings() {
    CONFIG.apiKey = document.getElementById('apiKeyInput').value.trim();
    CONFIG.model = document.getElementById('modelSelect').value;
    CONFIG.temperature = parseFloat(document.getElementById('temperatureInput').value);

    localStorage.setItem('openrouter_api_key', CONFIG.apiKey);
    localStorage.setItem('openrouter_model', CONFIG.model);
    localStorage.setItem('openrouter_temperature', CONFIG.temperature);

    settingsModal.classList.remove('active');
}

// ===== Event Listeners =====
sendBtn.addEventListener('click', sendMessage);

messageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

// Auto-resize textarea
messageInput.addEventListener('input', () => {
    messageInput.style.height = 'auto';
    messageInput.style.height = Math.min(messageInput.scrollHeight, 150) + 'px';
});

document.getElementById('newChatBtn').addEventListener('click', createNewChat);
document.getElementById('clearChatBtn').addEventListener('click', clearChat);
document.getElementById('settingsBtn').addEventListener('click', () => {
    loadSettings();
    settingsModal.classList.add('active');
});
document.getElementById('closeSettingsBtn').addEventListener('click', () => {
    settingsModal.classList.remove('active');
});
document.getElementById('saveSettingsBtn').addEventListener('click', saveSettings);

document.getElementById('temperatureInput').addEventListener('input', (e) => {
    document.getElementById('temperatureValue').textContent = e.target.value;
});

// ===== Init =====
createNewChat();
renderChatList();
