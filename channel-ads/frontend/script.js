// ===== Channel Ads Frontend =====

const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:3001/api'
    : 'https://channel-ads.onrender.com/api';

// State
let channels = [];
let currentChannel = null;

// ===== Initialization =====
document.addEventListener('DOMContentLoaded', () => {
    initTabs();
    initModals();
    loadChannels();
});

// ===== Tabs =====
function initTabs() {
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', () => {
            const tabName = tab.dataset.tab;

            // Update tab buttons
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            // Update tab content
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            document.getElementById('tab-' + tabName).classList.add('active');
        });
    });
}

// ===== Modals =====
function initModals() {
    // Add Channel Modal
    document.getElementById('addChannelBtn').addEventListener('click', openAddChannelModal);
    document.getElementById('addFirstChannelBtn').addEventListener('click', openAddChannelModal);
    document.getElementById('closeChannelModal').addEventListener('click', () => closeModal('addChannelModal'));
    document.getElementById('cancelChannelBtn').addEventListener('click', () => closeModal('addChannelModal'));

    // Channel Settings Modal
    document.getElementById('closeSettingsModal').addEventListener('click', () => closeModal('channelSettingsModal'));
    document.getElementById('cancelSettingsBtn').addEventListener('click', () => closeModal('channelSettingsModal'));
    document.getElementById('saveSettingsBtn').addEventListener('click', saveChannelSettings);

    // MAX Integration
    document.getElementById('settingsMaxChat').addEventListener('change', (e) => {
        if (e.target.value) {
            connectMaxChannel();
        }
    });
    document.getElementById('disconnectMaxBtn').addEventListener('click', disconnectMaxChannel);

    // Create Link Modal
    document.getElementById('createLinkBtn').addEventListener('click', openCreateLinkModal);
    document.getElementById('closeLinkModal').addEventListener('click', () => closeModal('createLinkModal'));
    document.getElementById('cancelLinkBtn').addEventListener('click', () => closeModal('createLinkModal'));
    document.getElementById('saveLinkBtn').addEventListener('click', createLink);

    // Link Created Modal
    document.getElementById('closeLinkCreatedModal').addEventListener('click', () => closeModal('linkCreatedModal'));
    document.getElementById('closeLinkCreatedBtn').addEventListener('click', () => closeModal('linkCreatedModal'));
    document.getElementById('copyLinkBtn').addEventListener('click', copyCreatedLink);

    // Channel selects
    document.getElementById('linksChannelSelect').addEventListener('change', onLinksChannelChange);
    document.getElementById('statsChannelSelect').addEventListener('change', onStatsChannelChange);

    // Close modal on overlay click
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                overlay.style.display = 'none';
            }
        });
    });
}

function openModal(id) {
    document.getElementById(id).style.display = 'flex';
}

function closeModal(id) {
    document.getElementById(id).style.display = 'none';
}

// ===== Channels =====
async function loadChannels() {
    const channelsList = document.getElementById('channelsList');
    channelsList.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

    try {
        const response = await fetch(API_BASE + '/channels', {
            headers: getAuthHeaders()
        });
        const data = await response.json();

        if (data.success) {
            channels = data.channels;
            renderChannels();
            updateChannelSelects();
        } else {
            // If no auth, show empty state
            channels = [];
            renderChannels();
        }
    } catch (error) {
        console.error('Error loading channels:', error);
        channels = [];
        renderChannels();
    }
}

function renderChannels() {
    const channelsList = document.getElementById('channelsList');
    const noChannelsState = document.getElementById('noChannelsState');

    if (channels.length === 0) {
        channelsList.innerHTML = '';
        noChannelsState.style.display = 'block';
        return;
    }

    noChannelsState.style.display = 'none';

    channelsList.innerHTML = channels.map(channel => `
        <div class="channel-card" data-code="${channel.tracking_code}">
            <div class="channel-info">
                <div class="channel-name">${escapeHtml(channel.title)}</div>
                <div class="channel-stats">
                    <span class="channel-stat">👥 ${channel.subscribers_count || 0} подписчиков</span>
                    <span class="channel-stat">👁 ${channel.visits_count || 0} визитов</span>
                </div>
                <div class="channel-badges">
                    ${channel.is_active ? '<span class="badge active">Активен</span>' : '<span class="badge">Неактивен</span>'}
                    ${channel.yandex_metrika_id ? '<span class="badge">Метрика</span>' : ''}
                    ${channel.vk_pixel_id ? '<span class="badge">VK Pixel</span>' : ''}
                    ${channel.max_connected ? '<span class="badge max">MAX</span>' : ''}
                </div>
            </div>
            <div class="channel-actions">
                <button class="btn btn-outline btn-small" onclick="openChannelSettings('${channel.tracking_code}')">
                    ⚙️ Настройки
                </button>
            </div>
        </div>
    `).join('');
}

function updateChannelSelects() {
    const options = '<option value="">Выберите канал</option>' +
        channels.map(ch => `<option value="${ch.tracking_code}">${escapeHtml(ch.title)}</option>`).join('');

    document.getElementById('linksChannelSelect').innerHTML = options;
    document.getElementById('statsChannelSelect').innerHTML = options;
}

function openAddChannelModal() {
    openModal('addChannelModal');
    // Could add polling for pending channels here
}

function openChannelSettings(trackingCode) {
    const channel = channels.find(c => c.tracking_code === trackingCode);
    if (!channel) return;

    document.getElementById('settingsChannelCode').value = trackingCode;
    document.getElementById('settingsYmId').value = channel.yandex_metrika_id || '';
    document.getElementById('settingsVkPixel').value = channel.vk_pixel_id || '';

    // Reset MAX section
    document.getElementById('maxConnectGroup').style.display = 'none';
    document.getElementById('maxConnectedInfo').style.display = 'none';
    document.getElementById('maxStatusLabel').textContent = 'Загрузка...';

    openModal('channelSettingsModal');

    // Load MAX status
    loadMaxStatus(channel);
}

// ===== MAX Integration =====
async function loadMaxStatus(channel) {
    try {
        const response = await fetch(API_BASE + '/max/status');
        const data = await response.json();

        if (!data.configured) {
            document.getElementById('maxStatusLabel').textContent = 'MAX бот не настроен';
            return;
        }

        if (!data.success) {
            document.getElementById('maxStatusLabel').textContent = 'Ошибка подключения к MAX';
            return;
        }

        // Check if channel has MAX connected
        if (channel.max_connected && channel.max_chat_id) {
            document.getElementById('maxStatusLabel').textContent = `Подключен к MAX (ID: ${channel.max_chat_id})`;
            document.getElementById('maxConnectedInfo').style.display = 'block';
        } else {
            document.getElementById('maxStatusLabel').textContent = 'MAX бот доступен';
            document.getElementById('maxConnectGroup').style.display = 'block';
            loadMaxChats();
        }
    } catch (error) {
        console.error('Error loading MAX status:', error);
        document.getElementById('maxStatusLabel').textContent = 'Ошибка загрузки статуса MAX';
    }
}

async function loadMaxChats() {
    const select = document.getElementById('settingsMaxChat');
    select.innerHTML = '<option value="">Загрузка...</option>';

    try {
        const response = await fetch(API_BASE + '/max/chats');
        const data = await response.json();

        if (data.success && data.chats) {
            select.innerHTML = '<option value="">Выберите канал</option>' +
                data.chats.map(chat =>
                    `<option value="${chat.chat_id}">${escapeHtml(chat.title || chat.chat_id)}</option>`
                ).join('');
        } else {
            select.innerHTML = '<option value="">Нет доступных каналов</option>';
        }
    } catch (error) {
        console.error('Error loading MAX chats:', error);
        select.innerHTML = '<option value="">Ошибка загрузки</option>';
    }
}

async function connectMaxChannel() {
    const trackingCode = document.getElementById('settingsChannelCode').value;
    const maxChatId = document.getElementById('settingsMaxChat').value;

    if (!maxChatId) {
        showToast('Выберите канал MAX', 'error');
        return;
    }

    try {
        const response = await fetch(API_BASE + '/max/connect/' + trackingCode, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ maxChatId })
        });

        const data = await response.json();

        if (data.success) {
            showToast('MAX канал подключен');
            loadChannels();

            // Update UI
            document.getElementById('maxConnectGroup').style.display = 'none';
            document.getElementById('maxConnectedInfo').style.display = 'block';
            document.getElementById('maxStatusLabel').textContent = `Подключен к MAX (ID: ${maxChatId})`;
        } else {
            showToast(data.error || 'Ошибка подключения', 'error');
        }
    } catch (error) {
        console.error('Error connecting MAX:', error);
        showToast('Ошибка подключения MAX', 'error');
    }
}

async function disconnectMaxChannel() {
    const trackingCode = document.getElementById('settingsChannelCode').value;

    if (!confirm('Отключить MAX канал?')) return;

    try {
        const response = await fetch(API_BASE + '/max/disconnect/' + trackingCode, {
            method: 'DELETE'
        });

        const data = await response.json();

        if (data.success) {
            showToast('MAX канал отключен');
            loadChannels();

            // Update UI
            document.getElementById('maxConnectedInfo').style.display = 'none';
            document.getElementById('maxConnectGroup').style.display = 'block';
            document.getElementById('maxStatusLabel').textContent = 'MAX бот доступен';
            loadMaxChats();
        } else {
            showToast(data.error || 'Ошибка отключения', 'error');
        }
    } catch (error) {
        console.error('Error disconnecting MAX:', error);
        showToast('Ошибка отключения MAX', 'error');
    }
}

async function saveChannelSettings() {
    const trackingCode = document.getElementById('settingsChannelCode').value;
    const yandex_metrika_id = document.getElementById('settingsYmId').value.trim();
    const vk_pixel_id = document.getElementById('settingsVkPixel').value.trim();

    try {
        const response = await fetch(API_BASE + '/channels/' + trackingCode, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                ...getAuthHeaders()
            },
            body: JSON.stringify({ yandex_metrika_id, vk_pixel_id })
        });

        const data = await response.json();

        if (data.success) {
            closeModal('channelSettingsModal');
            loadChannels();
            showToast('Настройки сохранены');
        } else {
            showToast(data.error || 'Ошибка сохранения', 'error');
        }
    } catch (error) {
        console.error('Error saving settings:', error);
        showToast('Ошибка сохранения', 'error');
    }
}

// ===== Links =====
function onLinksChannelChange(e) {
    currentChannel = e.target.value;
    document.getElementById('createLinkBtn').disabled = !currentChannel;

    if (currentChannel) {
        loadLinks();
    } else {
        document.getElementById('linksList').innerHTML = '';
        document.getElementById('noLinksState').style.display = 'block';
    }
}

async function loadLinks() {
    if (!currentChannel) return;

    const linksList = document.getElementById('linksList');
    linksList.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
    document.getElementById('noLinksState').style.display = 'none';

    try {
        const response = await fetch(API_BASE + '/links/' + currentChannel, {
            headers: getAuthHeaders()
        });
        const data = await response.json();

        if (data.success) {
            renderLinks(data.links);
        }
    } catch (error) {
        console.error('Error loading links:', error);
        linksList.innerHTML = '';
        document.getElementById('noLinksState').style.display = 'block';
    }
}

function renderLinks(links) {
    const linksList = document.getElementById('linksList');
    const noLinksState = document.getElementById('noLinksState');

    if (links.length === 0) {
        linksList.innerHTML = '';
        noLinksState.style.display = 'block';
        return;
    }

    noLinksState.style.display = 'none';

    linksList.innerHTML = links.map(link => {
        const fullUrl = `https://t.me/PKmarketingBot/subscribe?startapp=${link.short_code}`;
        return `
            <div class="link-card">
                <div class="link-header">
                    <div>
                        <div class="link-name">${escapeHtml(link.name)}</div>
                        <div class="link-utm">${link.utm_source}${link.utm_medium ? ' / ' + link.utm_medium : ''}${link.utm_campaign ? ' / ' + link.utm_campaign : ''}</div>
                    </div>
                    <button class="btn btn-outline btn-small btn-danger" onclick="deleteLink('${link.id}')">
                        🗑️ Удалить
                    </button>
                </div>
                <div class="link-stats">
                    <div class="link-stat">
                        <span class="link-stat-value">${link.visits_count || 0}</span>
                        <span class="link-stat-label">Визиты</span>
                    </div>
                    <div class="link-stat">
                        <span class="link-stat-value">${link.subscribers_count || 0}</span>
                        <span class="link-stat-label">Подписки</span>
                    </div>
                    <div class="link-stat">
                        <span class="link-stat-value">${link.visits_count > 0 ? Math.round(link.subscribers_count / link.visits_count * 100) : 0}%</span>
                        <span class="link-stat-label">Конверсия</span>
                    </div>
                </div>
                <div class="link-url">
                    <input type="text" value="${fullUrl}" readonly>
                    <button class="btn btn-outline btn-small" onclick="copyToClipboard('${fullUrl}')">📋 Копировать</button>
                </div>
            </div>
        `;
    }).join('');
}

function openCreateLinkModal() {
    document.getElementById('linkName').value = '';
    document.getElementById('linkUtmSource').value = '';
    document.getElementById('linkUtmMedium').value = '';
    document.getElementById('linkUtmCampaign').value = '';
    openModal('createLinkModal');
}

async function createLink() {
    const name = document.getElementById('linkName').value.trim();
    const utm_source = document.getElementById('linkUtmSource').value.trim();
    const utm_medium = document.getElementById('linkUtmMedium').value.trim();
    const utm_campaign = document.getElementById('linkUtmCampaign').value.trim();

    if (!name || !utm_source) {
        showToast('Заполните название и UTM Source', 'error');
        return;
    }

    try {
        const response = await fetch(API_BASE + '/links/' + currentChannel, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...getAuthHeaders()
            },
            body: JSON.stringify({ name, utm_source, utm_medium, utm_campaign })
        });

        const data = await response.json();

        if (data.success) {
            closeModal('createLinkModal');

            // Show created link
            const fullUrl = data.link.full_url || `https://t.me/PKmarketingBot/subscribe?startapp=${data.link.short_code}`;
            document.getElementById('createdLinkUrl').value = fullUrl;
            openModal('linkCreatedModal');

            loadLinks();
        } else {
            showToast(data.error || 'Ошибка создания ссылки', 'error');
        }
    } catch (error) {
        console.error('Error creating link:', error);
        showToast('Ошибка создания ссылки', 'error');
    }
}

async function deleteLink(linkId) {
    if (!confirm('Удалить ссылку?')) return;

    try {
        const response = await fetch(API_BASE + '/links/' + currentChannel + '/' + linkId, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });

        const data = await response.json();

        if (data.success) {
            loadLinks();
            showToast('Ссылка удалена');
        } else {
            showToast(data.error || 'Ошибка удаления', 'error');
        }
    } catch (error) {
        console.error('Error deleting link:', error);
        showToast('Ошибка удаления', 'error');
    }
}

function copyCreatedLink() {
    const url = document.getElementById('createdLinkUrl').value;
    copyToClipboard(url);
}

// ===== Stats =====
function onStatsChannelChange(e) {
    const trackingCode = e.target.value;

    if (trackingCode) {
        loadStats(trackingCode);
    } else {
        document.getElementById('statsContent').style.display = 'none';
        document.getElementById('noStatsState').style.display = 'block';
    }
}

async function loadStats(trackingCode) {
    document.getElementById('noStatsState').style.display = 'none';

    try {
        const response = await fetch(API_BASE + '/channels/' + trackingCode + '/stats', {
            headers: getAuthHeaders()
        });
        const data = await response.json();

        if (data.success) {
            document.getElementById('statsContent').style.display = 'block';

            // Update totals
            document.getElementById('statVisits').textContent = data.totals.total_visits || 0;
            document.getElementById('statSubscribers').textContent = data.totals.total_subscribers || 0;

            const cr = data.totals.total_visits > 0
                ? Math.round(data.totals.total_subscribers / data.totals.total_visits * 100)
                : 0;
            document.getElementById('statConversion').textContent = cr + '%';

            // Update UTM table
            const tbody = document.getElementById('utmStatsTable');
            if (data.utmStats && data.utmStats.length > 0) {
                tbody.innerHTML = data.utmStats.map(row => `
                    <tr>
                        <td>${escapeHtml(row.utm_source || '(direct)')}</td>
                        <td>${escapeHtml(row.utm_campaign || '-')}</td>
                        <td>${row.visits}</td>
                        <td>${row.subscribers}</td>
                        <td>${row.conversion || 0}%</td>
                    </tr>
                `).join('');
            } else {
                tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--text-secondary);">Нет данных</td></tr>';
            }
        }
    } catch (error) {
        console.error('Error loading stats:', error);
        document.getElementById('statsContent').style.display = 'none';
        document.getElementById('noStatsState').style.display = 'block';
    }
}

// ===== Utilities =====
function getAuthHeaders() {
    // For now, return empty. In production, this would include auth token
    return {};
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        showToast('Скопировано в буфер обмена');
    }).catch(() => {
        // Fallback
        const input = document.createElement('input');
        input.value = text;
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);
        showToast('Скопировано в буфер обмена');
    });
}

function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = 'toast' + (type === 'error' ? ' error' : '');
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
        toast.remove();
    }, 3000);
}
