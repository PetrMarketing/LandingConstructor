// ===== Планировщик контента =====

const CONFIG = {
    apiUrl: window.location.hostname === 'localhost'
        ? 'http://localhost:8000'
        : 'https://ai-tools-backend-d3zr.onrender.com',
    botToken: '8528588924:AAEYggmQxAo-sVZajljhtlsR4T-92fMeE3M'
};

// State
let projects = JSON.parse(localStorage.getItem('posting_projects') || '[]');
let posts = JSON.parse(localStorage.getItem('posting_posts') || '[]');
let selectedTimezone = localStorage.getItem('posting_timezone') || 'Europe/Moscow';
let currentDate = new Date();
let currentPostButtons = [];
let editingPostId = null;
let selectedDate = null;
let pendingChannelsInterval = null;

// DOM Elements
const noProjectsSection = document.getElementById('noProjectsSection');
const calendarSection = document.getElementById('calendarSection');
const calendarGrid = document.getElementById('calendarGrid');
const currentMonthEl = document.getElementById('currentMonth');
const projectFilter = document.getElementById('projectFilter');

// ===== Initialization =====
async function init() {
    // Initialize timezone selector
    const timezoneSelect = document.getElementById('timezoneSelect');
    if (timezoneSelect) {
        timezoneSelect.value = selectedTimezone;
    }

    updateUI();
    renderCalendar();
    setupEventListeners();

    // Sync posts with backend
    await syncPostsWithBackend();

    // Local scheduler as fallback (backend is primary)
    console.log(`[Scheduler] Frontend ready, backend handles scheduling`);
}

function updateUI() {
    if (projects.length === 0) {
        noProjectsSection.style.display = 'block';
        calendarSection.style.display = 'none';
    } else {
        noProjectsSection.style.display = 'none';
        calendarSection.style.display = 'block';
        updateProjectFilters();
    }
}

function updateProjectFilters() {
    // Update filter dropdown
    projectFilter.innerHTML = '<option value="all">Все проекты</option>';
    projects.forEach(p => {
        projectFilter.innerHTML += `<option value="${p.id}">${p.name}</option>`;
    });

    // Update post project dropdown
    const postProject = document.getElementById('postProject');
    if (postProject) {
        postProject.innerHTML = projects.map(p =>
            `<option value="${p.id}">${p.name}</option>`
        ).join('');
    }
}

// ===== Calendar =====
function renderCalendar() {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    // Update month title
    const monthNames = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
                        'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
    currentMonthEl.textContent = `${monthNames[month]} ${year}`;

    // Get first day of month and total days
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const totalDays = lastDay.getDate();

    // Get starting weekday (0 = Sunday, we need Monday = 0)
    let startWeekday = firstDay.getDay() - 1;
    if (startWeekday < 0) startWeekday = 6;

    // Get filter value
    const filterProject = projectFilter.value;

    // Build calendar HTML
    let html = '';
    const today = new Date();

    // Previous month days
    const prevMonth = new Date(year, month, 0);
    const prevMonthDays = prevMonth.getDate();

    for (let i = startWeekday - 1; i >= 0; i--) {
        const day = prevMonthDays - i;
        html += `<div class="calendar-day other-month">
            <div class="day-number">${day}</div>
        </div>`;
    }

    // Current month days
    for (let day = 1; day <= totalDays; day++) {
        const date = new Date(year, month, day);
        const dateStr = formatDate(date);
        const isToday = date.toDateString() === today.toDateString();

        // Get posts for this day
        let dayPosts = posts.filter(p => p.date === dateStr);
        if (filterProject !== 'all') {
            dayPosts = dayPosts.filter(p => p.projectId === filterProject);
        }

        const hasPosts = dayPosts.length > 0;

        html += `<div class="calendar-day ${isToday ? 'today' : ''} ${hasPosts ? 'has-posts' : ''}" data-date="${dateStr}">
            <div class="day-number">${day}</div>
            <div class="day-posts">
                ${dayPosts.slice(0, 3).map(post => {
                    const project = projects.find(p => p.id === post.projectId);
                    const statusClass = post.status || 'scheduled';
                    return `<div class="day-post ${statusClass}" data-post-id="${post.id}" title="${post.text?.substring(0, 50) || 'Пост'}">
                        ${post.time} ${project ? project.name : ''}
                    </div>`;
                }).join('')}
                ${dayPosts.length > 3 ? `<div class="day-post" style="background: var(--bg-tertiary);">+${dayPosts.length - 3} ещё</div>` : ''}
            </div>
            <button class="schedule-btn" data-date="${dateStr}">+ Запланировать</button>
        </div>`;
    }

    // Next month days
    const remainingDays = 42 - (startWeekday + totalDays);
    for (let day = 1; day <= remainingDays; day++) {
        html += `<div class="calendar-day other-month">
            <div class="day-number">${day}</div>
        </div>`;
    }

    calendarGrid.innerHTML = html;

    // Add click handlers
    document.querySelectorAll('.schedule-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            openScheduleModal(btn.dataset.date);
        });
    });

    document.querySelectorAll('.day-post[data-post-id]').forEach(el => {
        el.addEventListener('click', (e) => {
            e.stopPropagation();
            openViewPostModal(el.dataset.postId);
        });
    });
}

function formatDate(date) {
    return date.toISOString().split('T')[0];
}

// ===== Event Listeners =====
function setupEventListeners() {
    // Navigation
    document.getElementById('prevMonth').addEventListener('click', () => {
        currentDate.setMonth(currentDate.getMonth() - 1);
        renderCalendar();
    });

    document.getElementById('nextMonth').addEventListener('click', () => {
        currentDate.setMonth(currentDate.getMonth() + 1);
        renderCalendar();
    });

    projectFilter.addEventListener('change', renderCalendar);

    // Timezone selector
    document.getElementById('timezoneSelect').addEventListener('change', (e) => {
        selectedTimezone = e.target.value;
        localStorage.setItem('posting_timezone', selectedTimezone);
        updateTimezoneHint();
        showToast(`Часовой пояс: ${e.target.selectedOptions[0].text}`);
    });

    // Add Project
    document.getElementById('addProjectBtn').addEventListener('click', openProjectModal);
    document.getElementById('addFirstProjectBtn').addEventListener('click', openProjectModal);
    document.getElementById('closeProjectModal').addEventListener('click', closeProjectModal);
    document.getElementById('cancelProjectBtn').addEventListener('click', closeProjectModal);
    document.getElementById('saveProjectBtn').addEventListener('click', saveProject);

    // Schedule Post
    document.getElementById('closePostModal').addEventListener('click', closePostModal);
    document.getElementById('cancelPostBtn').addEventListener('click', closePostModal);
    document.getElementById('savePostBtn').addEventListener('click', savePost);

    // Generate Text
    document.getElementById('generateTextBtn').addEventListener('click', openGenerateTextModal);
    document.getElementById('closeGenerateTextModal').addEventListener('click', () => {
        document.getElementById('generateTextModal').style.display = 'none';
    });
    document.getElementById('cancelGenerateText').addEventListener('click', () => {
        document.getElementById('generateTextModal').style.display = 'none';
    });
    document.getElementById('confirmGenerateText').addEventListener('click', generateText);

    // Text character counter
    const postText = document.getElementById('postText');
    const charCounter = document.getElementById('charCounter');
    postText.addEventListener('input', updateCharCounter);

    // Image Upload
    const imageArea = document.getElementById('postImageArea');
    const imageInput = document.getElementById('postImageInput');

    imageArea.addEventListener('click', (e) => {
        if (e.target.id !== 'generateImageBtn' && e.target.id !== 'removeImageBtn') {
            imageInput.click();
        }
    });

    imageInput.addEventListener('change', handleImageUpload);
    document.getElementById('removeImageBtn').addEventListener('click', removeImage);

    // Generate Image
    document.getElementById('generateImageBtn').addEventListener('click', openGenerateImageModal);
    document.getElementById('closeGenerateImageModal').addEventListener('click', () => {
        document.getElementById('generateImageModal').style.display = 'none';
    });
    document.getElementById('cancelGenerateImage').addEventListener('click', () => {
        document.getElementById('generateImageModal').style.display = 'none';
    });
    document.getElementById('confirmGenerateImage').addEventListener('click', generateImage);

    // Post Buttons
    document.getElementById('addPostButton').addEventListener('click', openAddButtonModal);
    document.getElementById('closeButtonModal').addEventListener('click', () => {
        document.getElementById('addButtonModal').style.display = 'none';
    });
    document.getElementById('cancelButtonBtn').addEventListener('click', () => {
        document.getElementById('addButtonModal').style.display = 'none';
    });
    document.getElementById('saveButtonBtn').addEventListener('click', addPostButton);

    // View Post
    document.getElementById('closeViewPostModal').addEventListener('click', () => {
        document.getElementById('viewPostModal').style.display = 'none';
    });
    document.getElementById('deletePostBtn').addEventListener('click', deletePost);
    document.getElementById('editPostBtn').addEventListener('click', editPost);
    document.getElementById('sendNowBtn').addEventListener('click', sendPostNow);

    // Close modals on overlay click
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                overlay.style.display = 'none';
            }
        });
    });

    // Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            document.querySelectorAll('.modal-overlay').forEach(m => m.style.display = 'none');
        }
    });
}

// ===== Project Modal =====
function openProjectModal() {
    document.getElementById('projectChatId').value = '';
    document.getElementById('pendingChannels').style.display = 'none';
    document.getElementById('addProjectModal').style.display = 'flex';

    // Start polling for pending channels
    checkPendingChannels();
    pendingChannelsInterval = setInterval(checkPendingChannels, 3000);
}

function closeProjectModal() {
    document.getElementById('addProjectModal').style.display = 'none';

    // Stop polling
    if (pendingChannelsInterval) {
        clearInterval(pendingChannelsInterval);
        pendingChannelsInterval = null;
    }
}

async function checkPendingChannels() {
    try {
        const response = await fetch(`${CONFIG.apiUrl}/api/telegram/pending-channels`);
        const data = await response.json();

        const channels = data.channels || [];
        const pendingSection = document.getElementById('pendingChannels');
        const pendingList = document.getElementById('pendingChannelsList');

        // Filter out already added channels
        const newChannels = channels.filter(ch =>
            !projects.some(p => p.chatId === ch.id)
        );

        if (newChannels.length > 0) {
            pendingSection.style.display = 'block';
            pendingList.innerHTML = newChannels.map(ch => `
                <div class="pending-channel-item" data-chat-id="${ch.id}">
                    <div class="pending-channel-info">
                        <span class="pending-channel-name">${escapeHtml(ch.title)}</span>
                        <span class="pending-channel-id">${ch.username ? '@' + ch.username : ch.id}</span>
                    </div>
                    <button class="btn btn-primary add-pending-btn" data-channel='${JSON.stringify(ch)}'>Добавить</button>
                </div>
            `).join('');

            // Add click handlers
            pendingList.querySelectorAll('.add-pending-btn').forEach(btn => {
                btn.addEventListener('click', () => addPendingChannel(JSON.parse(btn.dataset.channel)));
            });
        } else {
            pendingSection.style.display = 'none';
        }
    } catch (error) {
        console.error('Error checking pending channels:', error);
    }
}

async function addPendingChannel(channel) {
    // Check if already added
    if (projects.some(p => p.chatId === channel.id)) {
        showToast('Этот канал уже добавлен', true);
        return;
    }

    const project = {
        id: Date.now().toString(),
        name: channel.title,
        chatId: channel.id,
        username: channel.username || null,
        type: channel.type,
        createdAt: new Date().toISOString()
    };

    projects.push(project);
    saveProjects();

    // Remove from pending on server
    try {
        await fetch(`${CONFIG.apiUrl}/api/telegram/pending-channels/${channel.id}`, {
            method: 'DELETE'
        });
    } catch (e) {
        // Ignore errors
    }

    closeProjectModal();
    updateUI();
    renderCalendar();
    showToast(`Канал "${channel.title}" добавлен`);
}

async function saveProject() {
    const chatId = document.getElementById('projectChatId').value.trim();

    if (!chatId) {
        showToast('Введите Chat ID канала', true);
        return;
    }

    showLoading('Проверка канала...');

    try {
        // Get chat info to verify and get name
        const response = await fetch(`https://api.telegram.org/bot${CONFIG.botToken}/getChat?chat_id=${encodeURIComponent(chatId)}`);
        const data = await response.json();

        if (!data.ok) {
            throw new Error(data.description || 'Канал не найден. Убедитесь, что бот добавлен в канал как администратор.');
        }

        const chat = data.result;
        const name = chat.title || chat.username || chatId;

        // Check if already added
        if (projects.some(p => p.chatId === chatId || p.chatId === chat.id.toString())) {
            throw new Error('Этот канал уже добавлен');
        }

        const project = {
            id: Date.now().toString(),
            name,
            chatId: chat.id.toString(),
            username: chat.username || null,
            type: chat.type,
            createdAt: new Date().toISOString()
        };

        projects.push(project);
        saveProjects();

        closeProjectModal();
        updateUI();
        renderCalendar();
        showToast(`Канал "${name}" добавлен`);

    } catch (error) {
        showToast('Ошибка: ' + error.message, true);
    } finally {
        hideLoading();
    }
}

// ===== Schedule Post Modal =====
function openScheduleModal(date) {
    if (projects.length === 0) {
        showToast('Сначала добавьте проект', true);
        return;
    }

    selectedDate = date;
    editingPostId = null;
    currentPostButtons = [];

    // Reset form
    document.getElementById('postDate').value = date;
    document.getElementById('postTime').value = '12:00';
    document.getElementById('postText').value = '';
    removeImage();
    renderPostButtons();
    updateCharCounter();

    // Update timezone hint
    updateTimezoneHint();

    // Update project dropdown
    updateProjectFilters();

    document.getElementById('schedulePostModal').style.display = 'flex';
}

function updateTimezoneHint() {
    const hint = document.getElementById('timezoneHint');
    if (hint) {
        const select = document.getElementById('timezoneSelect');
        if (select && select.selectedOptions[0]) {
            hint.textContent = select.selectedOptions[0].text;
        }
    }
}

function closePostModal() {
    document.getElementById('schedulePostModal').style.display = 'none';
    editingPostId = null;
}

async function savePost() {
    const projectId = document.getElementById('postProject').value;
    const project = projects.find(p => p.id === projectId);
    if (!project) {
        showToast('Проект не найден', true);
        return;
    }

    const date = document.getElementById('postDate').value;
    const time = document.getElementById('postTime').value;
    const text = document.getElementById('postText').value.trim();
    const imagePreview = document.getElementById('postImagePreview');
    const image = imagePreview.style.display !== 'none' ? imagePreview.src : null;

    if (!text && !image) {
        showToast('Добавьте текст или изображение', true);
        return;
    }

    // Telegram limits: 4096 chars for text, 1024 chars for photo caption
    if (image && text.length > 1024) {
        showToast('Текст с изображением не может превышать 1024 символа', true);
        return;
    }
    if (!image && text.length > 4096) {
        showToast('Текст не может превышать 4096 символов', true);
        return;
    }

    const post = {
        id: editingPostId || Date.now().toString(),
        projectId,
        chatId: project.chatId,
        date,
        time,
        timezone: selectedTimezone,
        text,
        image,
        buttons: [...currentPostButtons],
        status: 'scheduled',
        createdAt: editingPostId ? undefined : new Date().toISOString()
    };

    if (editingPostId) {
        const index = posts.findIndex(p => p.id === editingPostId);
        if (index !== -1) {
            post.createdAt = posts[index].createdAt;
            posts[index] = post;
        }
    } else {
        posts.push(post);
    }

    // Sync to backend
    showLoading('Сохранение...');
    try {
        await syncPostToBackend(post);
        savePosts();
        closePostModal();
        renderCalendar();
        showToast(editingPostId ? 'Пост обновлен' : 'Пост запланирован');
    } catch (error) {
        showToast('Ошибка сохранения: ' + error.message, true);
    } finally {
        hideLoading();
    }
}

async function syncPostToBackend(post) {
    const response = await fetch(`${CONFIG.apiUrl}/api/posts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(post)
    });

    if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || 'Ошибка сервера');
    }

    return response.json();
}

async function deletePostFromBackend(postId) {
    try {
        await fetch(`${CONFIG.apiUrl}/api/posts/${postId}`, {
            method: 'DELETE'
        });
    } catch (e) {
        console.error('Error deleting from backend:', e);
    }
}

async function syncPostsWithBackend() {
    try {
        console.log('[Sync] Syncing posts with backend...');

        // Get posts from backend
        const response = await fetch(`${CONFIG.apiUrl}/api/posts`);
        if (response.ok) {
            const data = await response.json();
            const backendPosts = data.posts || [];

            // Create a map of backend posts
            const backendMap = new Map(backendPosts.map(p => [p.id, p]));

            // Sync local posts that are not on backend yet
            for (const localPost of posts) {
                if (!backendMap.has(localPost.id) && localPost.status === 'scheduled') {
                    // Find project to get chatId
                    const project = projects.find(p => p.id === localPost.projectId);
                    if (project) {
                        localPost.chatId = project.chatId;
                        localPost.timezone = localPost.timezone || selectedTimezone;
                        console.log(`[Sync] Uploading local post ${localPost.id}`);
                        await syncPostToBackend(localPost);
                    }
                }
            }

            // Update local posts with backend status
            for (const backendPost of backendPosts) {
                const localIndex = posts.findIndex(p => p.id === backendPost.id);
                if (localIndex !== -1) {
                    // Update status from backend
                    posts[localIndex].status = backendPost.status;
                    posts[localIndex].sentAt = backendPost.sentAt;
                    posts[localIndex].error = backendPost.error;
                } else {
                    // Add backend post to local (if we don't have it)
                    posts.push(backendPost);
                }
            }

            savePosts();
            renderCalendar();
            console.log(`[Sync] Synced ${backendPosts.length} posts from backend`);
        }
    } catch (error) {
        console.error('[Sync] Error syncing with backend:', error);
    }
}

// ===== Image Handling =====
async function handleImageUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
        showToast('Выберите изображение', true);
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        setPostImage(e.target.result);
    };
    reader.readAsDataURL(file);
}

function setPostImage(src) {
    const preview = document.getElementById('postImagePreview');
    const placeholder = document.getElementById('imagePlaceholder');
    const removeBtn = document.getElementById('removeImageBtn');
    const area = document.getElementById('postImageArea');

    preview.src = src;
    preview.style.display = 'block';
    placeholder.style.display = 'none';
    removeBtn.style.display = 'flex';
    area.classList.add('has-image');
    updateCharCounter(); // Update limit to 1024
}

function removeImage(e) {
    if (e) e.stopPropagation();

    const preview = document.getElementById('postImagePreview');
    const placeholder = document.getElementById('imagePlaceholder');
    const removeBtn = document.getElementById('removeImageBtn');
    const area = document.getElementById('postImageArea');
    const input = document.getElementById('postImageInput');

    preview.src = '';
    preview.style.display = 'none';
    placeholder.style.display = 'flex';
    removeBtn.style.display = 'none';
    area.classList.remove('has-image');
    input.value = '';
    updateCharCounter(); // Update limit back to 4096
}

// ===== Generate Text =====
function openGenerateTextModal() {
    document.getElementById('textPrompt').value = '';
    document.getElementById('generateTextModal').style.display = 'flex';
}

async function generateText() {
    const prompt = document.getElementById('textPrompt').value.trim();

    if (!prompt) {
        showToast('Опишите, о чём должен быть пост', true);
        return;
    }

    showLoading('Генерация текста...');

    try {
        const response = await fetch(`${CONFIG.apiUrl}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                messages: [{
                    role: 'user',
                    content: `Напиши пост для Telegram канала на тему: ${prompt}

Требования:
- Пост должен быть кратким и увлекательным
- Используй эмодзи умеренно
- Добавь призыв к действию в конце
- Не используй хештеги
- Максимум 500 символов`
                }],
                model: 'openrouter/auto',
                temperature: 0.7
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.detail || 'Ошибка генерации');
        }

        document.getElementById('postText').value = data.content;
        document.getElementById('generateTextModal').style.display = 'none';
        showToast('Текст сгенерирован');

    } catch (error) {
        showToast('Ошибка: ' + error.message, true);
    } finally {
        hideLoading();
    }
}

// ===== Generate Image =====
function openGenerateImageModal() {
    document.getElementById('imagePrompt').value = '';
    document.getElementById('generateImageModal').style.display = 'flex';
}

async function generateImage() {
    const prompt = document.getElementById('imagePrompt').value.trim();

    if (!prompt) {
        showToast('Опишите изображение', true);
        return;
    }

    showLoading('Генерация изображения...');

    try {
        const response = await fetch(`${CONFIG.apiUrl}/api/generate-image`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                prompt: prompt,
                aspect_ratio: '1:1'
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.detail || 'Ошибка генерации');
        }

        setPostImage(data.image);
        document.getElementById('generateImageModal').style.display = 'none';
        showToast('Изображение сгенерировано');

    } catch (error) {
        showToast('Ошибка: ' + error.message, true);
    } finally {
        hideLoading();
    }
}

// ===== Post Buttons =====
function openAddButtonModal() {
    document.getElementById('buttonText').value = '';
    document.getElementById('buttonUrl').value = '';
    document.getElementById('addButtonModal').style.display = 'flex';
}

function addPostButton() {
    const text = document.getElementById('buttonText').value.trim();
    const url = document.getElementById('buttonUrl').value.trim();

    if (!text) {
        showToast('Введите текст кнопки', true);
        return;
    }

    if (!url) {
        showToast('Введите ссылку', true);
        return;
    }

    currentPostButtons.push({ text, url });
    renderPostButtons();
    document.getElementById('addButtonModal').style.display = 'none';
}

function renderPostButtons() {
    const container = document.getElementById('postButtonsList');
    container.innerHTML = currentPostButtons.map((btn, index) => `
        <div class="post-button-item">
            <div class="button-info">
                <div class="button-text">${escapeHtml(btn.text)}</div>
                <div class="button-url">${escapeHtml(btn.url)}</div>
            </div>
            <button class="remove-btn" data-index="${index}">×</button>
        </div>
    `).join('');

    container.querySelectorAll('.remove-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            currentPostButtons.splice(parseInt(btn.dataset.index), 1);
            renderPostButtons();
        });
    });
}

// ===== View Post Modal =====
function openViewPostModal(postId) {
    const post = posts.find(p => p.id === postId);
    if (!post) return;

    editingPostId = postId;
    const project = projects.find(p => p.id === post.projectId);

    const statusLabels = {
        scheduled: 'Запланирован',
        sent: 'Отправлен',
        failed: 'Ошибка'
    };

    document.getElementById('postPreview').innerHTML = `
        <div class="post-preview-header">
            <span class="post-preview-project">${project ? project.name : 'Неизвестный проект'}</span>
            <span class="post-status ${post.status || 'scheduled'}">${statusLabels[post.status] || 'Запланирован'}</span>
        </div>
        <div class="post-preview-time">${post.date} в ${post.time}</div>
        ${post.image ? `<img src="${post.image}" class="post-preview-image">` : ''}
        <div class="post-preview-text">${escapeHtml(post.text || '')}</div>
        ${post.buttons && post.buttons.length > 0 ? `
            <div class="post-preview-buttons">
                ${post.buttons.map(btn => `
                    <a href="${btn.url}" target="_blank" class="post-preview-button">${escapeHtml(btn.text)}</a>
                `).join('')}
            </div>
        ` : ''}
    `;

    // Show/hide buttons based on status
    const deleteBtn = document.getElementById('deletePostBtn');
    const editBtn = document.getElementById('editPostBtn');
    const sendBtn = document.getElementById('sendNowBtn');

    if (post.status === 'sent') {
        editBtn.style.display = 'none';
        sendBtn.style.display = 'none';
    } else {
        editBtn.style.display = 'inline-flex';
        sendBtn.style.display = 'inline-flex';
    }

    document.getElementById('viewPostModal').style.display = 'flex';
}

async function deletePost() {
    if (!editingPostId) return;

    if (!confirm('Удалить этот пост?')) return;

    // Delete from backend
    await deletePostFromBackend(editingPostId);

    posts = posts.filter(p => p.id !== editingPostId);
    savePosts();

    document.getElementById('viewPostModal').style.display = 'none';
    renderCalendar();
    showToast('Пост удален');
}

function editPost() {
    if (!editingPostId) return;

    const post = posts.find(p => p.id === editingPostId);
    if (!post) return;

    document.getElementById('viewPostModal').style.display = 'none';

    // Fill form with post data
    document.getElementById('postProject').value = post.projectId;
    document.getElementById('postDate').value = post.date;
    document.getElementById('postTime').value = post.time;
    document.getElementById('postText').value = post.text || '';

    if (post.image) {
        setPostImage(post.image);
    } else {
        removeImage();
    }

    currentPostButtons = post.buttons ? [...post.buttons] : [];
    renderPostButtons();
    updateCharCounter();

    updateProjectFilters();
    document.getElementById('schedulePostModal').style.display = 'flex';
}

async function sendPostNow() {
    if (!editingPostId) return;

    const post = posts.find(p => p.id === editingPostId);
    if (!post) return;

    await sendPost(post);

    document.getElementById('viewPostModal').style.display = 'none';
    renderCalendar();
}

// ===== Send Post to Telegram =====
async function sendPost(post) {
    const project = projects.find(p => p.id === post.projectId);
    if (!project) {
        showToast('Проект не найден', true);
        return false;
    }

    showLoading('Отправка поста...');

    try {
        let result;

        // Build inline keyboard if buttons exist
        let replyMarkup = null;
        if (post.buttons && post.buttons.length > 0) {
            replyMarkup = {
                inline_keyboard: post.buttons.map(btn => [{
                    text: btn.text,
                    url: btn.url
                }])
            };
        }

        if (post.image) {
            // Send photo with caption
            const formData = new FormData();
            formData.append('chat_id', project.chatId);
            formData.append('caption', post.text || '');
            // Don't use parse_mode for user-entered text to avoid HTML parsing issues

            if (replyMarkup) {
                formData.append('reply_markup', JSON.stringify(replyMarkup));
            }

            // Convert base64 to blob if needed
            if (post.image.startsWith('data:')) {
                const response = await fetch(post.image);
                const blob = await response.blob();
                formData.append('photo', blob, 'image.jpg');
            } else {
                formData.append('photo', post.image);
            }

            const response = await fetch(`https://api.telegram.org/bot${CONFIG.botToken}/sendPhoto`, {
                method: 'POST',
                body: formData
            });

            result = await response.json();
        } else {
            // Send text message
            const payload = {
                chat_id: project.chatId,
                text: post.text
                // Don't use parse_mode for user-entered text to avoid HTML parsing issues
            };

            if (replyMarkup) {
                payload.reply_markup = replyMarkup;
            }

            const response = await fetch(`https://api.telegram.org/bot${CONFIG.botToken}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            result = await response.json();
        }

        if (result.ok) {
            post.status = 'sent';
            post.sentAt = new Date().toISOString();
            savePosts();
            // Sync status to backend
            syncPostToBackend(post).catch(e => console.error('Sync error:', e));
            showToast('Пост отправлен!');
            return true;
        } else {
            throw new Error(result.description || 'Ошибка отправки');
        }

    } catch (error) {
        post.status = 'failed';
        post.error = error.message;
        savePosts();
        // Sync status to backend
        syncPostToBackend(post).catch(e => console.error('Sync error:', e));
        showToast('Ошибка: ' + error.message, true);
        return false;
    } finally {
        hideLoading();
    }
}

// ===== Periodic Sync =====
// Backend handles scheduling, frontend just syncs status periodically
setInterval(async () => {
    await syncPostsWithBackend();
}, 60000); // Sync every minute

// Get current time in selected timezone
function getCurrentTimeInTimezone() {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-GB', {
        timeZone: selectedTimezone,
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    });
    return formatter.format(now);
}

// ===== Storage =====
function saveProjects() {
    localStorage.setItem('posting_projects', JSON.stringify(projects));
}

function savePosts() {
    localStorage.setItem('posting_posts', JSON.stringify(posts));
}

// ===== UI Helpers =====
function showLoading(text = 'Загрузка...') {
    let overlay = document.querySelector('.loading-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.className = 'loading-overlay';
        overlay.innerHTML = `
            <div class="loading-spinner">⏳</div>
            <div class="loading-text">${text}</div>
        `;
        document.body.appendChild(overlay);
    } else {
        overlay.querySelector('.loading-text').textContent = text;
        overlay.style.display = 'flex';
    }
}

function hideLoading() {
    const overlay = document.querySelector('.loading-overlay');
    if (overlay) {
        overlay.style.display = 'none';
    }
}

function showToast(message, isError = false) {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = `toast ${isError ? 'error' : ''}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => toast.remove(), 3000);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function updateCharCounter() {
    const text = document.getElementById('postText').value;
    const counter = document.getElementById('charCounter');
    const imagePreview = document.getElementById('postImagePreview');
    const hasImage = imagePreview && imagePreview.style.display !== 'none';
    const limit = hasImage ? 1024 : 4096;

    counter.textContent = `${text.length} / ${limit}`;
    counter.classList.toggle('over-limit', text.length > limit);
}

// Initialize
init();
