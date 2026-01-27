// ===== Генератор презентаций =====

const CONFIG = {
    apiUrl: window.location.hostname === 'localhost'
        ? 'http://localhost:8000'
        : 'https://ai-tools-backend-d3zr.onrender.com'
};

// Референсные изображения для генерации слайдов
const REFERENCE_IMAGES = [
    'https://sun9-11.userapi.com/impg/SFMyhk8cGPf0KTT3rYeYYG8BZb-5kaS6YcYrHA/HgF1GVRjYZ8.jpg?size=1920x1080&quality=95&sign=5c8f9b7e3f4a6d2c1b0e9d8c7a6f5e4d&type=album',
    'https://sun9-9.userapi.com/impg/2D3_sFMKcVYcVBZ3sKKJLZbR9cPZVvXYg8j9Bg/xyz123.jpg?size=1920x1080&quality=95&sign=abc123&type=album',
    'https://sun9-56.userapi.com/impg/anotherimage.jpg?size=1920x1080&quality=95&sign=def456&type=album',
    'https://sun9-76.userapi.com/impg/yetanotherimage.jpg?size=1920x1080&quality=95&sign=ghi789&type=album'
];

// State
let uploadedFile = null;
let fileContent = '';
let generatedSlides = [];
let userLogoBase64 = null;
let generatedSlideImages = [];
let draggedSlideIndex = null;

// DOM Elements
const uploadArea = document.getElementById('uploadArea');
const fileInput = document.getElementById('fileInput');
const filePreview = document.getElementById('filePreview');
const fileName = document.getElementById('fileName');
const fileContentPreview = document.getElementById('fileContentPreview');
const generateSection = document.getElementById('generateSection');
const generateBtn = document.getElementById('generateBtn');
const resultsSection = document.getElementById('resultsSection');
const slidesContainer = document.getElementById('slidesContainer');
const slideCounter = document.getElementById('slideCounter');

// Design elements
const designSection = document.getElementById('designSection');
const previewSection = document.getElementById('previewSection');
const generationProgress = document.getElementById('generationProgress');

// ===== File Upload =====
uploadArea.addEventListener('click', () => fileInput.click());

uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.classList.add('dragover');
});

uploadArea.addEventListener('dragleave', () => {
    uploadArea.classList.remove('dragover');
});

uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
    if (e.dataTransfer.files[0]) {
        handleFile(e.dataTransfer.files[0]);
    }
});

fileInput.addEventListener('change', (e) => {
    if (e.target.files[0]) {
        handleFile(e.target.files[0]);
    }
});

async function handleFile(file) {
    const maxSize = 10000000; // 10MB для PDF
    if (file.size > maxSize) {
        alert('Файл слишком большой. Максимальный размер: 10MB');
        return;
    }

    uploadedFile = file;
    fileName.textContent = file.name;

    const ext = file.name.split('.').pop().toLowerCase();

    try {
        // Показываем индикатор загрузки
        fileContentPreview.textContent = 'Загрузка файла...';
        uploadArea.style.display = 'none';
        filePreview.style.display = 'block';

        if (ext === 'pdf') {
            fileContent = await extractPdfText(file);
        } else if (ext === 'xmind') {
            fileContent = await extractXmindText(file);
        } else {
            // Текстовые файлы
            fileContent = await readTextFile(file);
        }

        // Show preview
        fileContentPreview.textContent = fileContent.substring(0, 1000) + (fileContent.length > 1000 ? '...' : '');
        generateSection.style.display = 'block';

    } catch (error) {
        console.error('Error reading file:', error);
        alert('Ошибка чтения файла: ' + error.message);
        resetUpload();
    }
}

function readTextFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = reject;
        reader.readAsText(file);
    });
}

async function extractPdfText(file) {
    const arrayBuffer = await file.arrayBuffer();

    // Устанавливаем путь к воркеру PDF.js
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = '';

    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map(item => item.str).join(' ');
        fullText += `\n--- Страница ${i} ---\n${pageText}\n`;
    }

    return fullText.trim();
}

async function extractXmindText(file) {
    const arrayBuffer = await file.arrayBuffer();
    const zip = await JSZip.loadAsync(arrayBuffer);

    // XMind 8+ использует content.json
    let contentFile = zip.file('content.json');

    if (contentFile) {
        const content = await contentFile.async('string');
        const data = JSON.parse(content);
        return parseXmindJson(data);
    }

    // Старый формат XMind использует content.xml
    contentFile = zip.file('content.xml');
    if (contentFile) {
        const content = await contentFile.async('string');
        return parseXmindXml(content);
    }

    throw new Error('Не удалось прочитать содержимое .xmind файла');
}

function parseXmindJson(data) {
    let result = '';

    function extractTopics(topic, level = 0) {
        const indent = '  '.repeat(level);
        const title = topic.title || '';

        if (title) {
            result += `${indent}${level === 0 ? '' : '• '}${title}\n`;
        }

        if (topic.children && topic.children.attached) {
            topic.children.attached.forEach(child => extractTopics(child, level + 1));
        }
    }

    if (Array.isArray(data)) {
        data.forEach(sheet => {
            if (sheet.rootTopic) {
                result += `\n=== ${sheet.title || 'Карта'} ===\n`;
                extractTopics(sheet.rootTopic);
            }
        });
    }

    return result.trim();
}

function parseXmindXml(xmlContent) {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlContent, 'text/xml');
    let result = '';

    function extractTopics(element, level = 0) {
        const indent = '  '.repeat(level);
        const titleEl = element.querySelector(':scope > title');
        const title = titleEl ? titleEl.textContent : '';

        if (title) {
            result += `${indent}${level === 0 ? '' : '• '}${title}\n`;
        }

        const children = element.querySelectorAll(':scope > children > topics > topic');
        children.forEach(child => extractTopics(child, level + 1));
    }

    const topics = xmlDoc.querySelectorAll('topic');
    if (topics.length > 0) {
        extractTopics(topics[0]);
    }

    return result.trim();
}

function resetUpload() {
    uploadedFile = null;
    fileContent = '';
    fileInput.value = '';
    uploadArea.style.display = 'block';
    filePreview.style.display = 'none';
    generateSection.style.display = 'none';
}

document.getElementById('removeFile').addEventListener('click', () => {
    resetUpload();
    resultsSection.style.display = 'none';
    designSection.style.display = 'none';
    previewSection.style.display = 'none';
    generationProgress.style.display = 'none';
});

// ===== Generate Presentation with Streaming =====
generateBtn.addEventListener('click', generatePresentation);

async function generatePresentation() {
    if (!fileContent) {
        alert('Сначала загрузите файл');
        return;
    }

    const slideCount = document.getElementById('slideCount').value;

    // Build prompt
    const prompt = `Проанализируй этот документ и создай структуру презентации из примерно ${slideCount} слайдов.

ВАЖНО: Разделяй каждый слайд символом %
Для каждого слайда напиши ТОЛЬКО те слова/фразы, которые должны быть на слайде (кратко, тезисно).
Первая строка каждого слайда — это заголовок.

Формат ответа:
Заголовок слайда 1
• Тезис 1
• Тезис 2
• Тезис 3
%
Заголовок слайда 2
• Тезис 1
• Тезис 2
%
...и так далее

Документ для анализа:
${fileContent}`;

    setLoading(true);

    // Показываем секцию результатов со стримингом
    resultsSection.style.display = 'block';
    slidesContainer.innerHTML = '<div class="streaming-text" id="streamingOutput"><span class="streaming-cursor"></span></div>';
    resultsSection.scrollIntoView({ behavior: 'smooth' });

    // Скрываем кнопку перехода к дизайну пока идет генерация
    const goToDesignBtn = document.getElementById('goToDesignBtn');
    if (goToDesignBtn) goToDesignBtn.style.display = 'none';

    try {
        const response = await fetch(`${CONFIG.apiUrl}/api/chat/stream`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                messages: [{ role: 'user', content: prompt }],
                model: 'openrouter/auto',
                temperature: 0.7
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Ошибка генерации');
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullContent = '';
        const streamingOutput = document.getElementById('streamingOutput');

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n');

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const data = line.slice(6);
                    if (data === '[DONE]') continue;

                    try {
                        const parsed = JSON.parse(data);
                        const content = parsed.choices?.[0]?.delta?.content || '';
                        if (content) {
                            fullContent += content;
                            streamingOutput.innerHTML = escapeHtml(fullContent) + '<span class="streaming-cursor"></span>';
                            streamingOutput.scrollTop = streamingOutput.scrollHeight;
                        }
                    } catch (e) {
                        // Игнорируем невалидный JSON
                    }
                }
            }
        }

        // Parse slides by % separator
        parseAndDisplaySlides(fullContent);

    } catch (error) {
        console.error('Error:', error);
        // Fallback to non-streaming
        try {
            const response = await fetch(`${CONFIG.apiUrl}/api/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: [{ role: 'user', content: prompt }],
                    model: 'openrouter/auto',
                    temperature: 0.7
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.detail || 'Ошибка генерации');
            }

            parseAndDisplaySlides(data.content);
        } catch (fallbackError) {
            alert('Ошибка: ' + fallbackError.message);
            slidesContainer.innerHTML = '';
        }
    } finally {
        setLoading(false);
    }
}

function parseAndDisplaySlides(content) {
    // Split by % separator
    const rawSlides = content.split('%').map(s => s.trim()).filter(s => s.length > 0);

    generatedSlides = rawSlides.map((slideContent, index) => {
        const lines = slideContent.split('\n').filter(l => l.trim());
        const title = lines[0] || `Слайд ${index + 1}`;
        const body = lines.slice(1).join('\n');

        return { title, body, raw: slideContent };
    });

    displaySlides();

    // Показываем кнопку перехода к дизайну
    const goToDesignBtn = document.getElementById('goToDesignBtn');
    if (goToDesignBtn) {
        goToDesignBtn.style.display = 'inline-flex';
    }
}

function displaySlides() {
    slidesContainer.innerHTML = generatedSlides.map((slide, index) => `
        <div class="slide-card" data-index="${index}" draggable="true">
            <div class="slide-header">
                <div class="drag-handle" title="Перетащите для изменения порядка">⋮⋮</div>
                <div class="slide-number">${index + 1}</div>
                <div class="slide-title">${escapeHtml(slide.title)}</div>
                <button class="slide-copy" data-index="${index}" title="Копировать">📋</button>
                <button class="slide-delete" data-index="${index}" title="Удалить">×</button>
            </div>
            <div class="slide-content">${formatSlideContent(slide.body)}</div>
        </div>
    `).join('');

    slideCounter.textContent = `${generatedSlides.length} слайдов`;
    resultsSection.style.display = 'block';

    // Добавляем обработчики для кнопок копирования и удаления
    document.querySelectorAll('.slide-copy').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const index = parseInt(btn.dataset.index);
            copySlide(index);
        });
    });

    document.querySelectorAll('.slide-delete').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const index = parseInt(btn.dataset.index);
            deleteSlide(index);
        });
    });

    // Добавляем обработчики drag & drop
    initDragAndDrop();
}

// ===== Drag & Drop =====
function initDragAndDrop() {
    const slideCards = document.querySelectorAll('.slide-card');

    slideCards.forEach(card => {
        card.addEventListener('dragstart', handleDragStart);
        card.addEventListener('dragend', handleDragEnd);
        card.addEventListener('dragover', handleDragOver);
        card.addEventListener('dragenter', handleDragEnter);
        card.addEventListener('dragleave', handleDragLeave);
        card.addEventListener('drop', handleDrop);
    });
}

function handleDragStart(e) {
    draggedSlideIndex = parseInt(this.dataset.index);
    this.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', draggedSlideIndex.toString());

    // Добавляем задержку для визуального эффекта
    setTimeout(() => {
        this.style.opacity = '0.4';
    }, 0);
}

function handleDragEnd(e) {
    this.classList.remove('dragging');
    this.style.opacity = '1';
    document.querySelectorAll('.slide-card').forEach(card => {
        card.classList.remove('drag-over');
    });
}

function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    return false;
}

function handleDragEnter(e) {
    e.preventDefault();
    if (!this.classList.contains('dragging')) {
        this.classList.add('drag-over');
    }
}

function handleDragLeave(e) {
    // Проверяем, что мы действительно покинули элемент
    if (!this.contains(e.relatedTarget)) {
        this.classList.remove('drag-over');
    }
}

function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    this.classList.remove('drag-over');

    const toIndex = parseInt(this.dataset.index);

    if (draggedSlideIndex !== null && draggedSlideIndex !== toIndex) {
        reorderSlides(draggedSlideIndex, toIndex);
    }

    draggedSlideIndex = null;
    return false;
}

function reorderSlides(fromIndex, toIndex) {
    const slide = generatedSlides.splice(fromIndex, 1)[0];
    generatedSlides.splice(toIndex, 0, slide);
    displaySlides();
    showToast('Слайд перемещен');
}

// ===== Add Slide =====
const addSlideBtn = document.getElementById('addSlideBtn');
const addSlideModal = document.getElementById('addSlideModal');
const closeModalBtn = document.getElementById('closeModalBtn');
const cancelAddSlideBtn = document.getElementById('cancelAddSlideBtn');
const confirmAddSlideBtn = document.getElementById('confirmAddSlideBtn');

addSlideBtn.addEventListener('click', () => {
    document.getElementById('newSlideTitle').value = '';
    document.getElementById('newSlideContent').value = '';
    addSlideModal.style.display = 'flex';
    // Фокус на поле заголовка
    setTimeout(() => {
        document.getElementById('newSlideTitle').focus();
    }, 100);
});

closeModalBtn.addEventListener('click', closeModal);
cancelAddSlideBtn.addEventListener('click', closeModal);

addSlideModal.addEventListener('click', (e) => {
    if (e.target === addSlideModal) {
        closeModal();
    }
});

// Закрытие по Escape
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && addSlideModal.style.display === 'flex') {
        closeModal();
    }
});

function closeModal() {
    addSlideModal.style.display = 'none';
}

confirmAddSlideBtn.addEventListener('click', () => {
    const title = document.getElementById('newSlideTitle').value.trim();
    const content = document.getElementById('newSlideContent').value.trim();

    if (!title) {
        alert('Введите заголовок слайда');
        document.getElementById('newSlideTitle').focus();
        return;
    }

    addSlide(title, content);
    closeModal();
});

// Добавление слайда по Enter в поле заголовка
document.getElementById('newSlideTitle').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        document.getElementById('newSlideContent').focus();
    }
});

function addSlide(title, body) {
    generatedSlides.push({
        title,
        body,
        raw: `${title}\n${body}`
    });
    displaySlides();
    showToast('Слайд добавлен');

    // Скролл к новому слайду
    setTimeout(() => {
        const lastSlide = slidesContainer.lastElementChild;
        if (lastSlide) {
            lastSlide.scrollIntoView({ behavior: 'smooth' });
        }
    }, 100);
}

// ===== Delete Slide =====
function deleteSlide(index) {
    if (generatedSlides.length <= 1) {
        alert('Нельзя удалить последний слайд');
        return;
    }

    if (confirm(`Удалить слайд "${generatedSlides[index].title}"?`)) {
        generatedSlides.splice(index, 1);
        displaySlides();
        showToast('Слайд удален');
    }
}

// ===== Copy Slide =====
function copySlide(index) {
    const slide = generatedSlides[index];
    const text = `${slide.title}\n${slide.body}`;
    navigator.clipboard.writeText(text).then(() => {
        showToast('Слайд скопирован!');
    });
}

// Делаем функции глобальными для onclick
window.deleteSlide = deleteSlide;
window.copySlide = copySlide;

// ===== Go to Design =====
const goToDesignBtn = document.getElementById('goToDesignBtn');
if (goToDesignBtn) {
    goToDesignBtn.addEventListener('click', () => {
        designSection.style.display = 'block';
        designSection.scrollIntoView({ behavior: 'smooth' });
    });
}

// ===== Logo Upload =====
const logoUploadArea = document.getElementById('logoUploadArea');
const logoInput = document.getElementById('logoInput');
const logoPreview = document.getElementById('logoPreview');
const logoPlaceholder = document.getElementById('logoPlaceholder');

logoUploadArea.addEventListener('click', () => logoInput.click());

logoInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
        alert('Пожалуйста, выберите изображение');
        return;
    }

    try {
        userLogoBase64 = await fileToBase64(file);
        logoPreview.src = userLogoBase64;
        logoPreview.style.display = 'block';
        logoPlaceholder.style.display = 'none';
        showToast('Лого загружено');
    } catch (error) {
        console.error('Error loading logo:', error);
        alert('Ошибка загрузки изображения');
    }
});

function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// ===== Generate Slide Images =====
const generateFirstSlideBtn = document.getElementById('generateFirstSlideBtn');
const confirmStyleBtn = document.getElementById('confirmStyleBtn');
const regenerateBtn = document.getElementById('regenerateBtn');

generateFirstSlideBtn.addEventListener('click', generateFirstSlide);
confirmStyleBtn.addEventListener('click', confirmStyleAndGenerateAll);
regenerateBtn.addEventListener('click', generateFirstSlide);

async function generateFirstSlide() {
    if (generatedSlides.length === 0) {
        alert('Сначала сгенерируйте структуру презентации');
        return;
    }

    const color1 = document.getElementById('accentColor1').value;
    const color2 = document.getElementById('accentColor2').value;

    // Показываем превью секцию
    previewSection.style.display = 'block';
    const previewImage = document.getElementById('slidePreviewImage');
    const previewLoading = document.getElementById('previewLoading');

    previewImage.style.display = 'none';
    previewLoading.style.display = 'flex';
    previewLoading.innerHTML = '<div class="loading-spinner">⏳</div><span>Генерация слайда...</span>';

    previewSection.scrollIntoView({ behavior: 'smooth' });

    // Блокируем кнопку
    generateFirstSlideBtn.disabled = true;
    generateFirstSlideBtn.textContent = 'Генерация...';

    try {
        const firstSlide = generatedSlides[0];
        const slideText = `${firstSlide.title}\n${firstSlide.body}`;

        const imageData = await generateSlideImage(slideText, color1, color2);

        previewImage.src = imageData;
        previewImage.style.display = 'block';
        previewLoading.style.display = 'none';

        // Сохраняем первый слайд
        generatedSlideImages = [imageData];

        showToast('Первый слайд готов!');

    } catch (error) {
        console.error('Error generating slide:', error);
        previewLoading.innerHTML = `<span style="color: var(--error);">Ошибка: ${error.message}</span>`;
    } finally {
        generateFirstSlideBtn.disabled = false;
        generateFirstSlideBtn.textContent = 'Сгенерировать первый слайд';
    }
}

async function generateSlideImage(slideText, color1, color2) {
    const response = await fetch(`${CONFIG.apiUrl}/api/generate-slide`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            slide_text: slideText,
            color1: color1,
            color2: color2,
            user_image: userLogoBase64,
            reference_urls: REFERENCE_IMAGES
        })
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Ошибка генерации слайда');
    }

    const data = await response.json();
    return data.image;
}

async function confirmStyleAndGenerateAll() {
    if (generatedSlideImages.length === 0) {
        alert('Сначала сгенерируйте первый слайд');
        return;
    }

    const color1 = document.getElementById('accentColor1').value;
    const color2 = document.getElementById('accentColor2').value;

    // Скрываем превью, показываем прогресс
    previewSection.style.display = 'none';
    generationProgress.style.display = 'block';
    generationProgress.scrollIntoView({ behavior: 'smooth' });

    const progressText = document.getElementById('progressText');
    const progressFill = document.getElementById('progressFill');
    const gallery = document.getElementById('generatedSlidesGallery');

    // Добавляем первый слайд в галерею
    gallery.innerHTML = `
        <div class="generated-slide-thumb">
            <img src="${generatedSlideImages[0]}" alt="Слайд 1">
            <div class="slide-thumb-info">Слайд 1</div>
        </div>
    `;

    const totalSlides = generatedSlides.length;
    progressFill.style.width = `${(1 / totalSlides) * 100}%`;
    progressText.textContent = `Слайд 1 из ${totalSlides} готов`;

    // Генерируем остальные слайды
    for (let i = 1; i < totalSlides; i++) {
        progressText.textContent = `Генерация слайда ${i + 1} из ${totalSlides}...`;

        try {
            const slide = generatedSlides[i];
            const slideText = `${slide.title}\n${slide.body}`;

            const imageData = await generateSlideImage(slideText, color1, color2);
            generatedSlideImages.push(imageData);

            // Добавляем в галерею
            gallery.innerHTML += `
                <div class="generated-slide-thumb">
                    <img src="${imageData}" alt="Слайд ${i + 1}">
                    <div class="slide-thumb-info">Слайд ${i + 1}</div>
                </div>
            `;

            progressFill.style.width = `${((i + 1) / totalSlides) * 100}%`;

        } catch (error) {
            console.error(`Error generating slide ${i + 1}:`, error);
            gallery.innerHTML += `
                <div class="generated-slide-thumb error">
                    <div class="slide-thumb-info">Слайд ${i + 1} - Ошибка</div>
                </div>
            `;
        }
    }

    progressText.textContent = `Готово! ${totalSlides} слайдов сгенерировано`;
    showToast('Презентация готова!');
}

function formatSlideContent(content) {
    if (!content) return '<em style="color: var(--text-secondary);">Только заголовок</em>';

    // Convert bullet points to list
    const lines = content.split('\n');
    let html = '<ul>';

    lines.forEach(line => {
        const trimmed = line.trim();
        if (trimmed) {
            // Remove bullet characters if present
            const cleanLine = trimmed.replace(/^[•\-\*]\s*/, '');
            html += `<li>${escapeHtml(cleanLine)}</li>`;
        }
    });

    html += '</ul>';
    return html;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

document.getElementById('copyAllBtn').addEventListener('click', () => {
    const allText = generatedSlides.map((slide, i) =>
        `--- Слайд ${i + 1} ---\n${slide.title}\n${slide.body}`
    ).join('\n\n');

    navigator.clipboard.writeText(allText).then(() => {
        showToast('Все слайды скопированы!');
    });
});

document.getElementById('newPresentationBtn').addEventListener('click', () => {
    if (!confirm('Начать новую презентацию? Текущие данные будут потеряны.')) {
        return;
    }

    uploadedFile = null;
    fileContent = '';
    generatedSlides = [];
    generatedSlideImages = [];
    userLogoBase64 = null;
    fileInput.value = '';
    logoInput.value = '';

    uploadArea.style.display = 'block';
    filePreview.style.display = 'none';
    generateSection.style.display = 'none';
    resultsSection.style.display = 'none';
    designSection.style.display = 'none';
    previewSection.style.display = 'none';
    generationProgress.style.display = 'none';

    // Сброс лого
    logoPreview.style.display = 'none';
    logoPlaceholder.style.display = 'block';

    // Сброс галереи
    document.getElementById('generatedSlidesGallery').innerHTML = '';
    document.getElementById('progressFill').style.width = '0%';

    slideCounter.textContent = '0 слайдов';

    window.scrollTo({ top: 0, behavior: 'smooth' });
});

// ===== UI Helpers =====
function setLoading(loading) {
    generateBtn.disabled = loading;
    generateBtn.querySelector('.btn-text').style.display = loading ? 'none' : 'inline';
    generateBtn.querySelector('.btn-loader').style.display = loading ? 'inline' : 'none';
}

function showToast(message) {
    // Удаляем предыдущий тост если есть
    const existingToast = document.querySelector('.toast-message');
    if (existingToast) existingToast.remove();

    const toast = document.createElement('div');
    toast.className = 'toast-message';
    toast.style.cssText = `
        position: fixed;
        bottom: 30px;
        left: 50%;
        transform: translateX(-50%);
        background: var(--success);
        color: white;
        padding: 12px 24px;
        border-radius: 8px;
        font-size: 0.9rem;
        z-index: 1000;
        animation: fadeInOut 2s ease;
    `;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => toast.remove(), 2000);
}

// Add animation style
const style = document.createElement('style');
style.textContent = `
    @keyframes fadeInOut {
        0% { opacity: 0; transform: translateX(-50%) translateY(20px); }
        20% { opacity: 1; transform: translateX(-50%) translateY(0); }
        80% { opacity: 1; transform: translateX(-50%) translateY(0); }
        100% { opacity: 0; transform: translateX(-50%) translateY(-20px); }
    }
`;
document.head.appendChild(style);
